use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    path::BaseDirectory,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, RunEvent, Runtime, Url, WindowEvent,
};
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

/// Trust-boundary check for a `file://` URL delivered by `RunEvent::Opened`.
///
/// `Path::is_file()` follows symlinks (it calls `stat`), so a decoy such as
/// `/tmp/decoy.png -> ~/.ssh/id_rsa` would otherwise pass the extension
/// whitelist and end up granting read access to the symlink target through
/// `tauri-plugin-fs` (which adds the canonicalized path to its scope).
///
/// Two layers of defense:
///   1. Reject if the path itself is a symlink (`symlink_metadata` = `lstat`).
///   2. After canonicalize, re-apply the extension whitelist so even a future
///      refactor that accidentally allows symlinks cannot escape the
///      whitelist on the resolved target.
fn is_safe_image_path(path: &Path) -> bool {
    let meta = match std::fs::symlink_metadata(path) {
        Ok(m) => m,
        Err(_) => return false,
    };
    if meta.file_type().is_symlink() {
        return false;
    }
    if !meta.is_file() {
        return false;
    }
    if !has_allowed_extension(path) {
        return false;
    }
    match std::fs::canonicalize(path) {
        Ok(real) => has_allowed_extension(&real),
        Err(_) => false,
    }
}

/// Pick the first safe image path from the URL list delivered by
/// `RunEvent::Opened`. Non-`file://` URLs, non-whitelisted extensions,
/// non-existing paths, symlinks, and directories are all rejected here so
/// downstream code never touches anything outside the whitelist.
fn pick_first_open_image_path(urls: &[Url]) -> Option<PathBuf> {
    urls.iter()
        .filter(|u| u.scheme() == "file")
        .filter_map(|u| u.to_file_path().ok())
        .find(|p| is_safe_image_path(p))
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
            let app_submenu = SubmenuBuilder::new(app, "Marianne")
                .item(&PredefinedMenuItem::about(app, None, None)?)
                .separator()
                .item(&PredefinedMenuItem::services(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::hide(app, None)?)
                .item(&PredefinedMenuItem::hide_others(app, None)?)
                .item(&PredefinedMenuItem::show_all(app, None)?)
                .separator()
                .item(&app_quit_item)
                .build()?;
            // Edit submenu lets the user reach standard clipboard shortcuts
            // (Cmd+C / Cmd+V / Cmd+X / Cmd+A) via the macOS menu when the
            // webview does not handle them directly.
            let edit_submenu = SubmenuBuilder::new(app, "Edit")
                .item(&PredefinedMenuItem::undo(app, None)?)
                .item(&PredefinedMenuItem::redo(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::cut(app, None)?)
                .item(&PredefinedMenuItem::copy(app, None)?)
                .item(&PredefinedMenuItem::paste(app, None)?)
                .item(&PredefinedMenuItem::select_all(app, None)?)
                .build()?;
            let app_menu = MenuBuilder::new(app)
                .item(&app_submenu)
                .item(&edit_submenu)
                .build()?;
            app.set_menu(app_menu)?;

            Ok(())
        })
        .on_menu_event(|app, event| {
            // Application-menu events (from `app.set_menu` above). Tray menu
            // events go through `TrayIconBuilder::on_menu_event` separately.
            if event.id().as_ref() == "app-quit" {
                request_quit(app);
            }
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
        fn pick_first_rejects_non_file_scheme_and_nonexistent() {
            let urls = vec![
                Url::parse("http://example.com/a.png").unwrap(),
                Url::parse("file:///nonexistent/missing.png").unwrap(),
            ];
            assert!(pick_first_open_image_path(&urls).is_none());
        }
    }
}
