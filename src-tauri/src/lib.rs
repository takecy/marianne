use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use tauri::{
    image::Image,
    menu::{AboutMetadata, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    path::BaseDirectory,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, RunEvent, Runtime, Url, WindowEvent,
};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_fs::FsExt;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Buffer of file paths queued by `RunEvent::Opened` (macOS "Open With").
/// The frontend drains this on mount via the `take_pending_open_paths`
/// command so cold-start opens are not lost when the WebView is not ready
/// to receive events yet.
#[derive(Default)]
struct PendingOpenPaths(Mutex<Vec<PathBuf>>);

/// Gate that lets `RunEvent::ExitRequested` distinguish a fresh quit
/// request (must be confirmed by the renderer) from a programmatic
/// `app.exit(0)` issued by `confirm_quit` after the user already
/// confirmed (must pass through).
#[derive(Default)]
struct QuitConfirmed(AtomicBool);

/// Flipped to true once the renderer has finished mounting and has
/// registered its `listen("quit-requested")` handler. Until this is
/// true, `ExitRequested` falls through to a normal exit — preventing
/// the cold-start race where the user presses Cmd+Q before the
/// frontend listener exists (which would otherwise wedge the app
/// into an unquittable state). Mirrors the cold-start buffer pattern
/// used by `PendingOpenPaths` for "Open With".
#[derive(Default)]
struct RendererReady(AtomicBool);

/// Extensions accepted from macOS "Open With". Must align with
/// `fileAssociations[].ext` in `tauri.conf.json`. Case-insensitive match.
const ALLOWED_OPEN_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg"];

fn has_allowed_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| {
            ALLOWED_OPEN_EXTENSIONS
                .iter()
                .any(|a| a.eq_ignore_ascii_case(e))
        })
        .unwrap_or(false)
}

/// Trust-boundary check for a path delivered by `RunEvent::Opened` (macOS
/// "Open With"), `File → Open...` dialog (via `pick_and_open_image`), or any
/// other Rust-side ingress.
///
/// Returns `Some(canonical_path)` when the path passes all checks, or `None`
/// if any check fails. Callers must use the returned canonical `PathBuf`
/// (not the original input) for any subsequent `scope.allow_file()` or emit,
/// to keep the verified-path and granted-path strings byte-identical. This
/// removes the "path string mismatch" class of symlink decoys (e.g.
/// `/tmp/decoy.png -> ~/.ssh/id_rsa`).
///
/// Note: this is **NOT** a full TOCTOU defense. A parent-directory-controlling
/// attacker can still swap the target between this validation and the
/// subsequent `readFile`. Full defense (e.g. `O_NOFOLLOW` FD retention) is
/// out of scope for this layer — see issue #28 discussion.
///
/// Two layers of defense kept from the previous `is_safe_image_path` design:
///   1. Reject if the path itself is a symlink (`symlink_metadata` = `lstat`).
///   2. After canonicalize, re-apply the extension whitelist so even a future
///      refactor that accidentally allows symlinks cannot escape the
///      whitelist on the resolved target.
fn safe_image_canonical(path: &Path) -> Option<PathBuf> {
    let meta = std::fs::symlink_metadata(path).ok()?;
    if meta.file_type().is_symlink() {
        return None;
    }
    if !meta.is_file() {
        return None;
    }
    if !has_allowed_extension(path) {
        return None;
    }
    let canonical = std::fs::canonicalize(path).ok()?;
    if !has_allowed_extension(&canonical) {
        return None;
    }
    Some(canonical)
}

/// Boolean wrapper for `safe_image_canonical`. Kept for call sites that only
/// need a pass/fail decision and for backwards-compatible unit tests.
#[cfg(test)]
fn is_safe_image_path(path: &Path) -> bool {
    safe_image_canonical(path).is_some()
}

/// Pick the first safe image path from the URL list delivered by
/// `RunEvent::Opened`. Non-`file://` URLs, non-whitelisted extensions,
/// non-existing paths, symlinks, and directories are all rejected here so
/// downstream code never touches anything outside the whitelist.
///
/// Returns the canonicalized form of the first safe path so the caller can
/// pass it directly to `handle_opened_image_path` without re-canonicalizing
/// (avoids the path-string mismatch class of TOCTOU).
fn pick_first_open_image_path(urls: &[Url]) -> Option<PathBuf> {
    urls.iter()
        .filter(|u| u.scheme() == "file")
        .filter_map(|u| u.to_file_path().ok())
        .find_map(|p| safe_image_canonical(&p))
}

/// Forward a single vetted image path to the frontend.
/// Grants scope only for this exact path (mirroring tauri-plugin-fs's
/// drag-drop pattern, but constrained to the whitelist), queues it for the
/// cold-start drain, restores the window, and emits a live event for the
/// already-mounted (warm-start) case.
fn handle_opened_image_path<R: Runtime>(app: &AppHandle<R>, path: PathBuf) {
    let scope = app.fs_scope();
    let _ = scope.allow_file(&path);

    if let Some(state) = app.try_state::<PendingOpenPaths>() {
        if let Ok(mut guard) = state.0.lock() {
            guard.push(path.clone());
        }
    }

    show_main_window(app);

    let payload = vec![path.to_string_lossy().into_owned()];
    let _ = app.emit("file-open-requested", payload);
}

/// Open a native file dialog for selecting an image, validate the chosen
/// path through the Rust trust boundary, and forward to the existing
/// `file-open-requested` pipeline. Used by the `File → Open... (Cmd+O)`
/// menu item.
///
/// **Why a custom Rust command** instead of `@tauri-apps/plugin-dialog`'s JS
/// `open()`: the plugin's JS path internally calls
/// `scope.allow_file(&path)` **before** returning the path to the renderer
/// (see `tauri-plugin-dialog-2.7.1/src/commands.rs:203`). That would widen
/// the renderer's fs scope *before* our validation runs, breaking the
/// "Rust-side trust boundary" requirement (issue #28 `[C-4]`). By driving
/// the dialog directly through `DialogExt` here, the scope is only granted
/// in the canonicalized form after `safe_image_canonical` passes.
///
/// The `pick_file` callback runs asynchronously on the dialog thread; the
/// command itself returns immediately. The actual image load is delivered
/// to the frontend through `handle_opened_image_path` → `app.emit
/// ("file-open-requested", ...)` once the user picks a file.
#[tauri::command]
fn pick_and_open_image<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let app_clone = app.clone();
    app.dialog()
        .file()
        .add_filter("Images", &["png", "jpg", "jpeg"])
        .pick_file(move |path_opt| {
            let Some(file_path) = path_opt else {
                return; // user canceled
            };
            // FilePath can be either an OS path or a URL (e.g. on mobile);
            // we only handle native paths on desktop.
            let Ok(p) = PathBuf::try_from(file_path) else {
                return;
            };
            if let Some(canonical) = safe_image_canonical(&p) {
                handle_opened_image_path(&app_clone, canonical);
            }
            // Silent on validation failure; UI feedback is out of scope.
        });
    Ok(())
}

/// Drain the cold-start buffer and return the queued paths to the frontend.
/// Called once on `useImageLoader` mount.
#[tauri::command]
fn take_pending_open_paths(state: tauri::State<'_, PendingOpenPaths>) -> Vec<String> {
    let Ok(mut guard) = state.0.lock() else {
        return Vec::new();
    };
    let drained: Vec<PathBuf> = std::mem::take(&mut *guard);
    drained
        .into_iter()
        .map(|p| p.to_string_lossy().into_owned())
        .collect()
}

/// Renderer-initiated confirmation that the user clicked "終了する".
/// Flips the gate and triggers a final exit cycle; the next
/// `ExitRequested` will short-circuit and let the process terminate.
#[tauri::command]
fn confirm_quit(app: AppHandle, state: tauri::State<'_, QuitConfirmed>) {
    state.0.store(true, Ordering::SeqCst);
    app.exit(0);
}

/// Called once by the renderer immediately after `listen("quit-requested")`
/// has been registered. Enables the quit-confirmation flow; before this
/// is called, `ExitRequested` falls through to a normal exit.
#[tauri::command]
fn renderer_ready(state: tauri::State<'_, RendererReady>) {
    state.0.store(true, Ordering::SeqCst);
}

/// Bring the main window to the front from a hidden, minimised, or unfocused state.
fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Shared quit entry point used by the macOS Cmd+Q menu accelerator and the
/// tray "Quit Marianne" item. Tauri v2 on macOS bypasses `RunEvent::ExitRequested`
/// for the OS-level Cmd+Q keystroke (it goes through WKWebView → direct process
/// termination), so we capture Cmd+Q via a custom application MenuItem instead
/// and route both paths through here. If the renderer has not finished mounting
/// the `quit-requested` listener yet, fall back to a direct exit so the user is
/// never stuck with an unquittable app (cold-start safety, mirrors
/// `PendingOpenPaths`).
fn request_quit<R: Runtime>(app: &AppHandle<R>) {
    let ready = app.state::<RendererReady>().0.load(Ordering::SeqCst);
    if !ready {
        app.exit(0);
        return;
    }
    show_main_window(app);
    let _ = app.emit("quit-requested", ());
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        // macOS Launch Services does not forward "Open With" paths via argv,
        // so we only restore the window here. File delivery is handled by the
        // `RunEvent::Opened` arm below.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init());

    // Self-update plugin is desktop-only; mobile targets cannot build the
    // updater crate, so the plugin registration mirrors the target cfg in
    // Cargo.toml.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .manage(PendingOpenPaths::default())
        .manage(QuitConfirmed::default())
        .manage(RendererReady::default())
        .setup(|app| {
            let show_item = MenuItemBuilder::with_id("show", "Show Marianne").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Quit Marianne").build(app)?;
            let tray_menu = MenuBuilder::new(app)
                .item(&show_item)
                .separator()
                .item(&quit_item)
                .build()?;

            let menubar_icon_path = app
                .path()
                .resolve("icons/menubar.png", BaseDirectory::Resource)?;
            let menubar_icon = Image::from_path(&menubar_icon_path)?;

            let _tray = TrayIconBuilder::new()
                .icon(menubar_icon)
                .icon_as_template(true)
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main_window(app),
                    // Route the tray Quit through the same handler the
                    // Cmd+Q application menu uses so both paths show the
                    // unsaved-shapes confirmation dialog.
                    "quit" => request_quit(app),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            // Build a minimal macOS application menu. The "Quit Marianne"
            // item uses our own MenuItemBuilder (not PredefinedMenuItem::quit)
            // with the Cmd+Q accelerator, so when the user presses Cmd+Q the
            // event flows through `Builder::on_menu_event` instead of
            // `[NSApp terminate:]`. This is the macOS-specific workaround for
            // the Tauri v2 behaviour where the OS-level Cmd+Q skips
            // `RunEvent::ExitRequested` and goes straight to process exit.
            //
            // PredefinedMenuItem entries are kept for standard macOS UX
            // (About / Hide / Hide Others / Show All / Services) so the user
            // is not surprised by missing items.
            let app_quit_item = MenuItemBuilder::with_id("app-quit", "Quit Marianne")
                .accelerator("Cmd+Q")
                .build(app)?;
            // Only `copyright` and `credits` are populated because the other
            // AboutMetadata fields (authors / comments / license / website /
            // website_label) are documented as macOS: Unsupported in Tauri
            // 2.11 and are not forwarded to NSAboutPanel by muda's macOS
            // backend. The U+00A9 escape (instead of a literal ©) avoids
            // editor / diff width-handling surprises in this UTF-8 source.
            let about_metadata = AboutMetadata {
                credits: Some("Skitch-style offline image annotation app".to_string()),
                copyright: Some("\u{00A9} 2026 takecy".to_string()),
                ..Default::default()
            };
            let app_submenu = SubmenuBuilder::new(app, "Marianne")
                .item(&PredefinedMenuItem::about(app, None, Some(about_metadata))?)
                .separator()
                .item(&PredefinedMenuItem::services(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::hide(app, None)?)
                .item(&PredefinedMenuItem::hide_others(app, None)?)
                .item(&PredefinedMenuItem::show_all(app, None)?)
                .separator()
                .item(&app_quit_item)
                .build()?;
            // File submenu: image-level actions wired to the frontend via
            // `app.emit("menu-action", id)` in `on_menu_event` below.
            // Open... drives the new `pick_and_open_image` command which
            // opens a native dialog Rust-side (NOT through JS open()) so
            // that fs scope is only granted after `safe_image_canonical`
            // passes.
            let file_open = MenuItemBuilder::with_id("file-open", "Open...")
                .accelerator("Cmd+O")
                .build(app)?;
            let file_save_as = MenuItemBuilder::with_id("file-save-as", "Save As...")
                .accelerator("Cmd+Shift+S")
                .build(app)?;
            let file_copy_clipboard =
                MenuItemBuilder::with_id("file-copy-clipboard", "Copy to Clipboard")
                    .accelerator("Cmd+Shift+C")
                    .build(app)?;
            let file_submenu = SubmenuBuilder::new(app, "File")
                .item(&file_open)
                .separator()
                .item(&file_save_as)
                .item(&file_copy_clipboard)
                .build()?;

            // Edit submenu. Undo/Redo/Delete are custom MenuItemBuilder
            // entries so we can route them through `on_menu_event` to the
            // frontend (canvas shape undo/redo/delete in `canvasStore`).
            // Cut/Copy/Paste/SelectAll remain PredefinedMenuItem so the
            // standard Cocoa text-edit behaviour applies to focused inputs.
            let edit_undo = MenuItemBuilder::with_id("edit-undo", "Undo")
                .accelerator("Cmd+Z")
                .build(app)?;
            let edit_redo = MenuItemBuilder::with_id("edit-redo", "Redo")
                .accelerator("Cmd+Shift+Z")
                .build(app)?;
            // Intentionally **no accelerator** on Delete. macOS routes a
            // keystroke registered as a menu accelerator straight to the
            // menu handler and suppresses the corresponding keydown — so
            // registering `Backspace` here would steal text-edit Backspace
            // (typing a character) and turn it into a canvas shape
            // deletion while the user has a text input focused. The
            // existing JS keydown in `CanvasArea.tsx` already handles
            // Backspace / Delete with the proper text-edit bail-out, so
            // we leave the menu item as a click-only entry. The shortcut
            // hint is omitted from menubar but the JS path keeps the
            // expected `Backspace` / `Delete` behaviour.
            let edit_delete = MenuItemBuilder::with_id("edit-delete", "Delete").build(app)?;
            let edit_submenu = SubmenuBuilder::new(app, "Edit")
                .item(&edit_undo)
                .item(&edit_redo)
                .separator()
                .item(&edit_delete)
                .separator()
                .item(&PredefinedMenuItem::cut(app, None)?)
                .item(&PredefinedMenuItem::copy(app, None)?)
                .item(&PredefinedMenuItem::paste(app, None)?)
                .item(&PredefinedMenuItem::select_all(app, None)?)
                .build()?;
            // Order: Marianne (app) → File → Edit. macOS convention.
            let app_menu = MenuBuilder::new(app)
                .item(&app_submenu)
                .item(&file_submenu)
                .item(&edit_submenu)
                .build()?;
            app.set_menu(app_menu)?;

            Ok(())
        })
        .on_menu_event(|app, event| {
            // Application-menu events (from `app.set_menu` above). Tray menu
            // events go through `TrayIconBuilder::on_menu_event` separately.
            //
            // `app-quit` is handled inline so the renderer-confirmation gate
            // (see `request_quit`) stays Rust-side. All other menu ids are
            // forwarded to the frontend over the `menu-action` channel,
            // where `useMenuAction` dispatches them to the matching
            // handler in `App.tsx`.
            let id = event.id().as_ref();
            if id == "app-quit" {
                request_quit(app);
                return;
            }
            let _ = app.emit("menu-action", id.to_string());
        })
        // Close button on the main window hides instead of quitting so the
        // tray icon can later restore the window with in-flight edits intact.
        // Cmd+Q and the tray "Quit Marianne" action go through ExitRequested
        // instead, so they are unaffected.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            take_pending_open_paths,
            confirm_quit,
            renderer_ready,
            pick_and_open_image,
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app, event| match event {
            // Quit request gate. The first ExitRequested for any session
            // is intercepted so the renderer can ask the user whether to
            // drop unsaved annotations. The renderer then calls
            // `confirm_quit`, which flips QuitConfirmed and re-enters this
            // arm; the second pass sees `confirmed == true` and lets the
            // process exit.
            //
            // `code` is intentionally unused: tray "Quit Marianne" issues
            // `app.exit(0)` and Cmd+Q has no code, but both should funnel
            // through the same confirmation path.
            //
            // Cold-start safety: if the renderer has not yet registered
            // its `listen("quit-requested")` handler (RendererReady ==
            // false), the emit below would be lost and the user could
            // never quit. Fall through to a normal exit in that case —
            // losing unsaved shapes is preferable to creating an
            // unquittable app state.
            RunEvent::ExitRequested { api, .. } => {
                let confirmed = app
                    .state::<QuitConfirmed>()
                    .0
                    .load(Ordering::SeqCst);
                if confirmed {
                    return;
                }
                let ready = app
                    .state::<RendererReady>()
                    .0
                    .load(Ordering::SeqCst);
                if !ready {
                    return;
                }
                api.prevent_exit();
                request_quit(app);
            }
            // macOS fires Reopen when the user clicks the Dock icon. When
            // there are no visible windows (main window was hidden via
            // close = hide), restore the main window so Dock click matches
            // user expectation.
            RunEvent::Reopen {
                has_visible_windows: false,
                ..
            } => {
                show_main_window(app);
            }
            // macOS "Open With" / iOS / Android file open. The trust boundary
            // (extension whitelist, symlink rejection, real-file check) is
            // enforced by `pick_first_open_image_path`; anything that does
            // not pass it is silently ignored — no scope grant, no emit.
            #[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
            RunEvent::Opened { urls } => {
                if let Some(path) = pick_first_open_image_path(&urls) {
                    handle_opened_image_path(app, path);
                }
            }
            _ => {}
        });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extension_check_is_case_insensitive() {
        assert!(has_allowed_extension(Path::new("/tmp/a.png")));
        assert!(has_allowed_extension(Path::new("/tmp/a.PNG")));
        assert!(has_allowed_extension(Path::new("/tmp/a.JPG")));
        assert!(has_allowed_extension(Path::new("/tmp/a.jpeg")));
        assert!(!has_allowed_extension(Path::new("/tmp/a.gif")));
        assert!(!has_allowed_extension(Path::new("/tmp/a.webp")));
        assert!(!has_allowed_extension(Path::new("/tmp/secret.txt")));
        assert!(!has_allowed_extension(Path::new("/tmp/noext")));
    }

    #[cfg(unix)]
    mod fs_tests {
        use super::*;
        use std::fs::File;
        use std::os::unix::fs::symlink;
        use tempfile::tempdir;

        #[test]
        fn accepts_real_image_file() {
            let dir = tempdir().unwrap();
            let png = dir.path().join("real.png");
            File::create(&png).unwrap();
            assert!(is_safe_image_path(&png));
        }

        #[test]
        fn rejects_symlink_with_image_extension_pointing_to_secret() {
            // Threat model: /tmp/decoy.png -> /tmp/secret.txt (stand-in for
            // ~/.ssh/id_rsa). Must be rejected before any scope grant.
            let dir = tempdir().unwrap();
            let secret = dir.path().join("secret.txt");
            File::create(&secret).unwrap();
            let decoy = dir.path().join("decoy.png");
            symlink(&secret, &decoy).unwrap();
            assert!(
                !is_safe_image_path(&decoy),
                "symlink with image extension pointing to a non-image must be rejected"
            );
        }

        #[test]
        fn rejects_symlink_even_if_target_is_image() {
            // Even when the target itself is a whitelisted image we reject
            // the symlink so the trust path stays single and predictable.
            let dir = tempdir().unwrap();
            let real = dir.path().join("real.png");
            File::create(&real).unwrap();
            let alias = dir.path().join("alias.png");
            symlink(&real, &alias).unwrap();
            assert!(!is_safe_image_path(&alias));
        }

        #[test]
        fn rejects_directory_with_image_extension() {
            let dir = tempdir().unwrap();
            let sub = dir.path().join("sub.png");
            std::fs::create_dir(&sub).unwrap();
            assert!(!is_safe_image_path(&sub));
        }

        #[test]
        fn rejects_nonexistent_path() {
            let dir = tempdir().unwrap();
            assert!(!is_safe_image_path(&dir.path().join("ghost.png")));
        }

        #[test]
        fn pick_first_picks_first_safe_image() {
            let dir = tempdir().unwrap();
            let png = dir.path().join("a.png");
            File::create(&png).unwrap();
            let urls = vec![
                Url::from_file_path(dir.path().join("ghost.txt")).unwrap(),
                Url::from_file_path(&png).unwrap(),
                Url::from_file_path(dir.path().join("later.png")).unwrap(),
            ];
            let picked = pick_first_open_image_path(&urls);
            // Compare canonical forms to absorb macOS /var -> /private/var
            // symlinks in tempdir paths.
            let canonical_expected = std::fs::canonicalize(&png).unwrap();
            let canonical_picked = picked
                .as_deref()
                .map(std::fs::canonicalize)
                .and_then(Result::ok);
            assert_eq!(canonical_picked.as_deref(), Some(canonical_expected.as_path()));
        }

        #[test]
        fn pick_first_skips_symlink_decoy_in_list() {
            let dir = tempdir().unwrap();
            let secret = dir.path().join("secret.txt");
            File::create(&secret).unwrap();
            let decoy = dir.path().join("decoy.png");
            symlink(&secret, &decoy).unwrap();
            let real = dir.path().join("real.png");
            File::create(&real).unwrap();
            let urls = vec![
                Url::from_file_path(&decoy).unwrap(),
                Url::from_file_path(&real).unwrap(),
            ];
            let picked = pick_first_open_image_path(&urls);
            let canonical_expected = std::fs::canonicalize(&real).unwrap();
            let canonical_picked = picked
                .as_deref()
                .map(std::fs::canonicalize)
                .and_then(Result::ok);
            assert_eq!(canonical_picked.as_deref(), Some(canonical_expected.as_path()));
        }

        #[test]
        fn safe_image_canonical_returns_consistent_path_on_repeated_calls() {
            // Regression guard for issue #28: the canonical path returned
            // by `safe_image_canonical` must be deterministic for the same
            // input so callers can safely use it for both `scope.allow_file`
            // and the subsequent emit without worrying about path-string
            // mismatch (the "two different strings for the same file"
            // class of TOCTOU).
            let dir = tempdir().unwrap();
            let png = dir.path().join("stable.png");
            File::create(&png).unwrap();
            let first = safe_image_canonical(&png).expect("first canonical");
            let second = safe_image_canonical(&png).expect("second canonical");
            assert_eq!(
                first, second,
                "canonical path must be deterministic for the same input"
            );
            // And the returned form must itself be a canonical absolute
            // path (so e.g. /var/... is resolved to /private/var/... on
            // macOS).
            let direct = std::fs::canonicalize(&png).unwrap();
            assert_eq!(first, direct);
        }

        #[test]
        fn pick_first_rejects_non_file_scheme_and_nonexistent() {
            let urls = vec![
                Url::parse("http://example.com/a.png").unwrap(),
                Url::parse("file:///nonexistent/missing.png").unwrap(),
            ];
            assert!(pick_first_open_image_path(&urls).is_none());
        }
    }
}
