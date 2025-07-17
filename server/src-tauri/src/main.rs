// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use actix_web::{ App, HttpServer };
use actix_web::rt::SystemRunner;
use actix_cors::Cors;
use std::thread;
use routes::moves::save_move;

mod routes {
    pub mod moves;
}

fn main() {
    // Inicia o servidor Actix Web em uma thread separada
    thread::spawn(move || {
        let sys: SystemRunner = actix_web::rt::System::new();

        sys.block_on(async move {
            HttpServer::new(move || {
               let cors = Cors::default()
                    .allow_any_origin()
                    .allow_any_method()
                    .allow_any_header()
                    .max_age(3600);

                App::new()
                    .wrap(cors)
                    .service(save_move)
            })
                .bind(("127.0.0.1", 8080))
                .expect("Não foi possível iniciar o servidor HTTP")
                .run().await
                .expect("Erro ao rodar o servidor HTTP");
        });
    });

    // Inicia o Tauri normalmente
    server_rust_lib::run()
}
