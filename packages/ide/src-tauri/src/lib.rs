use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

mod cli;
mod clipboard_files;
mod discord_rpc;
mod editing_kit;
mod game_launch;
mod mcc_install;
mod settings;
mod steam;
mod workspace_discover;

use cli::{CliArgs, CliExitCode, create_headless_cli_window, is_cli_invocation};
use discord_rpc::DiscordRpc;
use mcc_install::MccInstallInfo;
use settings::MegacrowSettings;
use tauri::webview::Color;
use tauri::{AppHandle, RunEvent, WebviewUrl, WebviewWindowBuilder};

/// Matches CSS `--bg-app` so the native window isn't white before the page paints.
const APP_BACKGROUND: Color = Color(0x1e, 0x1e, 0x1e, 0xff);
use workspace_discover::DiscoveredWorkspace;

#[tauri::command]
fn update_discord_presence(
  discord: tauri::State<DiscordRpc>,
  details: Option<String>,
  presence_state: Option<String>,
) -> Result<(), String> {
  discord.update(details, presence_state);
  Ok(())
}

#[tauri::command]
fn set_discord_presence_enabled(
  discord: tauri::State<DiscordRpc>,
  enabled: bool,
) -> Result<(), String> {
  discord.set_enabled(enabled);
  Ok(())
}

/// Open the web inspector for the calling window. Only debug builds ship
/// devtools; the toolbar shows the button only there, and release builds
/// report an error instead of doing nothing silently.
#[tauri::command]
fn open_devtools(window: tauri::WebviewWindow) -> Result<(), String> {
  #[cfg(debug_assertions)]
  {
    window.open_devtools();
    Ok(())
  }
  #[cfg(not(debug_assertions))]
  {
    let _ = window;
    Err("DevTools are only available in debug builds".into())
  }
}

#[tauri::command]
fn get_discord_username(discord: tauri::State<DiscordRpc>) -> Option<String> {
  discord.username()
}

#[tauri::command]
fn write_mcc_hot_reload_mglo(data: Vec<u8>) -> Result<String, String> {
  let path = mcc_hot_reload_mglo_path();
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
  }
  fs::write(&path, data).map_err(|error| error.to_string())?;

  let resolved = fs::canonicalize(&path).unwrap_or(path);
  Ok(resolved.to_string_lossy().into_owned())
}

fn mcc_hot_reload_mglo_path() -> PathBuf {
  if let Ok(profile) = std::env::var("USERPROFILE") {
    return PathBuf::from(profile)
      .join("AppData")
      .join("LocalLow")
      .join("MCC")
      .join("Temporary")
      .join("HaloReach")
      .join("HotReload")
      .join(".mglo");
  }

  PathBuf::from(".")
    .join("LocalLow")
    .join("MCC")
    .join("Temporary")
    .join("HaloReach")
    .join("HotReload")
    .join(".mglo")
}

#[tauri::command]
fn detect_mcc_install() -> MccInstallInfo {
  mcc_install::detect_mcc_install()
}

#[tauri::command]
fn launch_mcc() -> Result<(), String> {
  mcc_install::launch_mcc()
}

#[tauri::command]
fn launch_game_command(command: String) -> Result<(), String> {
  game_launch::launch_game_command(command)
}

#[tauri::command]
fn load_megacrow_settings(app: AppHandle) -> Result<Option<MegacrowSettings>, String> {
  settings::load_settings(&app)
}

#[tauri::command]
fn save_megacrow_settings(app: AppHandle, settings: MegacrowSettings) -> Result<(), String> {
  settings::save_settings(&app, &settings)
}

#[tauri::command]
fn discover_hrek_workspaces() -> Vec<DiscoveredWorkspace> {
  workspace_discover::discover_hrek_workspaces()
}

fn create_main_window(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
  WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
    .title("MegaloEvolved")
    .inner_size(1440.0, 900.0)
    .min_inner_size(960.0, 600.0)
    .resizable(true)
    .fullscreen(false)
    .decorations(false)
    .shadow(true)
    .background_color(APP_BACKGROUND)
    .build()?;
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let args: Vec<String> = std::env::args().skip(1).collect();
  let cli_mode = is_cli_invocation(&args);

  if cli_mode {
    cli::attach_parent_console();
    // Quiet Chromium/WebView2 logging for the headless CLI window.
    std::env::set_var(
      "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
      "--disable-logging --log-level=3",
    );
  }

  let exit_code = Arc::new(Mutex::new(None));
  let cli_exit = CliExitCode(exit_code.clone());

  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_clipboard_manager::init())
    .manage(DiscordRpc::new())
    .manage(CliArgs(args))
    .manage(cli_exit)
    .invoke_handler(tauri::generate_handler![
      write_mcc_hot_reload_mglo,
      update_discord_presence,
      set_discord_presence_enabled,
      get_discord_username,
      open_devtools,
      detect_mcc_install,
      launch_mcc,
      launch_game_command,
      load_megacrow_settings,
      save_megacrow_settings,
      discover_hrek_workspaces,
      editing_kit::regenerate_object_lists_with_tool,
      clipboard_files::clipboard_write_files,
      cli::get_cli_args,
      cli::cli_log,
      cli::cli_complete
    ])
    .setup(move |app| {
      if cli_mode {
        create_headless_cli_window(app)?;
      } else {
        create_main_window(app)?;
        if cfg!(debug_assertions) {
          app.handle().plugin(
            tauri_plugin_log::Builder::default()
              .level(log::LevelFilter::Info)
              .build(),
          )?;
        }
      }
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building MegaloEvolved")
    .run(|_app_handle, event| {
      if let RunEvent::Exit = event {
        // CLI exit code is read after the run loop returns.
      }
    });

  if cli_mode {
    let code = exit_code.lock().ok().and_then(|value| *value).unwrap_or(1);
    std::process::exit(code);
  }
}
