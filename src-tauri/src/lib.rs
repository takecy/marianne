use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
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

/// Bring the main window to the front from a hidden, minimised, or unfocused state.
fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
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
        .setup(|app| {
            let show_item = MenuItemBuilder::with_id("show", "Show Marianne").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Quit Marianne").build(app)?;
            let menu = MenuBuilder::new(app)
                .item(&show_item)
                .separator()
                .item(&quit_item)
                .build()?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main_window(app),
                    "quit" => app.exit(0),
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

            Ok(())
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
        .invoke_handler(tauri::generate_handler![greet, take_pending_open_paths])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app, event| match event {
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
