#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let _ = winbox_backend::startup::apply_update_from_args(std::env::args_os());
}
