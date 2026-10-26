import os
from pathlib import Path

# Configurações de saída
PASTA_DESTINO = "_exportacao_gemini"
NOME_ARQUIVO = "contexto_fleetguard.md"

# Filtros para manter o arquivo limpo e focado
EXTENSOES_VALIDAS = {'.py', '.ts', '.html', '.scss', '.css', '.json', '.ps1'}
PASTAS_IGNORADAS = {'node_modules', 'venv', '.env', '.git', '__pycache__', '.angular', 'dist', PASTA_DESTINO}
ARQUIVOS_IGNORADOS = {'package-lock.json', 'gerar_contexto.py'}

def deve_ignorar_pasta(caminho):
    return any(pasta_ignorada in caminho.parts for pasta_ignorada in PASTAS_IGNORADAS)

def gerar_arquivo_contexto():
    caminho_base = Path('.')
    caminho_destino = caminho_base / PASTA_DESTINO
    
    # Cria a pasta de destino se não existir
    caminho_destino.mkdir(exist_ok=True)
    arquivo_saida = caminho_destino / NOME_ARQUIVO

    arquivos_processados = 0

    with open(arquivo_saida, 'w', encoding='utf-8') as f_out:
        f_out.write("# Contexto do Projeto: Fleet-Guard\n\n")
        
        for root, dirs, files in os.walk(caminho_base):
            caminho_atual = Path(root)
            
            # Pula pastas indesejadas
            if deve_ignorar_pasta(caminho_atual):
                continue
                
            for file in files:
                caminho_arquivo = caminho_atual / file
                extensao = caminho_arquivo.suffix.lower()
                
                if extensao in EXTENSOES_VALIDAS and file not in ARQUIVOS_IGNORADOS:
                    try:
                        with open(caminho_arquivo, 'r', encoding='utf-8') as f_in:
                            conteudo = f_in.read()
                            
                        # Remove o './' inicial para o caminho ficar mais limpo
                        caminho_relativo = str(caminho_arquivo).replace('\\', '/').removeprefix('./')
                        
                        # Formata com cabeçalho e bloco de código markdown
                        f_out.write(f"### Arquivo: {caminho_relativo}\n")
                        f_out.write(f"```{extensao.strip('.')}\n")
                        f_out.write(conteudo)
                        f_out.write(f"\n```\n\n")
                        
                        arquivos_processados += 1
                    except Exception as e:
                        print(f"Erro ao ler {caminho_arquivo}: {e}")

    print(f"✅ Sucesso! {arquivos_processados} arquivos combinados.")
    print(f"📂 Arquivo salvo em: {arquivo_saida.resolve()}")

if __name__ == "__main__":
    gerar_arquivo_contexto()