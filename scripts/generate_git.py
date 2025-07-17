import os
import shutil
import subprocess

def main():
    # Diretório onde estão os arquivos
    directory = "."

    # Filtra todos os arquivos PNG (exceto dentro de temp_frames)
    png_files = [
        f for f in os.listdir(directory)
        if f.lower().endswith(".png") and not f.startswith("temp_frames")
    ]

    if not png_files:
        print("Nenhum arquivo PNG encontrado.")
        return

    # Ordena pelo nome (começam pelo timestamp)
    png_files.sort()

    # Cria ou recria pasta temporária
    temp_dir = os.path.join(directory, "temp_frames")
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir)
    os.makedirs(temp_dir)

    # Copia cada arquivo sequencialmente
    for idx, filename in enumerate(png_files, start=1):
        new_name = f"frame{idx:04d}.png"
        src = os.path.join(directory, filename)
        dst = os.path.join(temp_dir, new_name)
        shutil.copy2(src, dst)
        print(f"Copiado: {filename} -> {new_name}")

    # Comando ffmpeg
    ffmpeg_cmd = [
        "ffmpeg",
        "-y",                     # Sobrescreve sem perguntar
        "-framerate", "10",       # Frames por segundo
        "-i", "frame%04d.png",    # Entrada sequencial
        "-vf", "scale=640:-1",    # Redimensiona largura
        "../output.gif"           # Saída
    ]

    print("\nExecutando ffmpeg...")
    subprocess.run(ffmpeg_cmd, cwd=temp_dir)

    print("\nGIF criado: output.gif")

if __name__ == "__main__":
    main()
