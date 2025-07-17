use actix_multipart::Multipart;
use actix_web::{post, web, Error, HttpResponse};
use directories::UserDirs;
use futures_util::stream::TryStreamExt;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::fs::{self, File};
use tokio::io::AsyncWriteExt;

#[post("/moves")]
pub async fn save_move(mut payload: Multipart) -> Result<HttpResponse, Error> {
    // --- 1. Extração dos dados do formulário ---
    let mut game_id: Option<String> = None;
    let mut image_data: Option<web::Bytes> = None;
    let mut file_extension: Option<String> = None;

    while let Some(mut field) = payload.try_next().await? {
        // Desempacota o Option<&ContentDisposition>
        if let Some(disposition) = field.content_disposition() {
            match disposition.get_name() {
                Some("gameId") => {
                    // Lê o valor do campo gameId como uma string simples
                    let mut data = Vec::new();
                    while let Some(chunk) = field.try_next().await? {
                        data.extend_from_slice(&chunk);
                    }
                    if let Ok(id_str) = String::from_utf8(data) {
                        // Apenas verifica se a string não está vazia
                        if !id_str.is_empty() {
                            game_id = Some(id_str);
                        }
                    }
                }
                Some("image") => {
                    // Extrai a extensão do nome do arquivo original
                    if let Some(filename) = disposition.get_filename() {
                        if let Some(ext) = Path::new(filename).extension().and_then(|s| s.to_str())
                        {
                            file_extension = Some(format!(".{}", ext));
                        }
                    }

                    // Lê os bytes do arquivo
                    let mut data = Vec::new();
                    while let Some(chunk) = field.try_next().await? {
                        data.extend_from_slice(&chunk);
                    }
                    image_data = Some(web::Bytes::from(data));
                }
                _ => (), // Ignora outros campos
            }
        }
    }

    // Valida se os campos necessários foram recebidos
    let (game_id_str, image_bytes, ext) = match (game_id, image_data, file_extension) {
        (Some(id), Some(bytes), Some(ext)) => (id, bytes, ext),
        _ => {
            return Ok(HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Campos 'gameId' e/ou 'image' ausentes ou inválidos."
            })));
        }
    };

    // --- 2. Construção dos Caminhos e Nomes de Arquivo ---

    let doc_dir = match UserDirs::new().and_then(|dirs| dirs.document_dir().map(PathBuf::from)) {
        Some(path) => path,
        None => {
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Não foi possível encontrar o diretório de Documentos."
            })));
        }
    };

    let app_name = "Jigsaw Companion";
    let target_dir = doc_dir.join(app_name).join("images").join(&game_id_str);

    if let Err(_) = fs::create_dir_all(&target_dir).await {
        return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "Falha ao criar diretórios."
        })));
    }

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();

    let filename = format!("{}-{}{}", timestamp, game_id_str, ext);
    let file_path = target_dir.join(filename);

    // --- 3. Salvamento do Arquivo ---

    match File::create(&file_path).await {
        Ok(mut file) => {
            if let Err(_) = file.write_all(&image_bytes).await {
                return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": "Falha ao escrever dados no arquivo."
                })));
            }
        }
        Err(_) => {
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Falha ao criar o arquivo de imagem."
            })));
        }
    }

    // --- 4. Resposta de Sucesso ---
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": format!("Movimento para o jogo {} processado com sucesso.", game_id_str),
        "filePath": file_path.to_str().unwrap_or("")
    })))
}
