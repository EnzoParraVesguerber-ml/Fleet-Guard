# FleetGuard 🚌⚙️

## Visão Geral

O **FleetGuard** é uma solução de inteligência artificial e IoT focada na manutenção preditiva de frotas de autocarros urbanos pesados. Desenvolvido no contexto de soluções para Smart Cities (como parte das atividades do programa **Usina de Projetos Experimentais - UPX**), o projeto aplica conceitos de modelagem matemática e arquitetura de sistemas para prever o desgaste mecânico e térmico dos veículos antes que ocorram falhas críticas.

A aplicação é dividida em:

- Um **motor de simulação baseada em física**;
- Um **pipeline de treinamento de aprendizado de máquina** otimizado para séries temporais;
- Um **backend em Flask** responsável por receber telemetria, calcular tendências em tempo real e armazenar o histórico no PostgreSQL.

---

## 🏗️ Arquitetura e Componentes

### 1. Edge Simulation (Gerador de Dados)

O módulo `fleetguard_mock_generator.py` não é um gerador de dados aleatórios simples. Ele implementa uma **máquina de estados de condução** (marcha lenta, aceleração, cruzeiro e frenagem) acoplada a **equações diferenciais** que simulam a inércia térmica do motor e o desgaste contínuo de componentes.

Ele injeta falhas realistas como:

- **Superaquecimento** (degradação da bomba d'água/radiador);
- **Atuação de Derate** pela ECU;
- **Desgaste de rolamentos** e atrito de pinça de freio presa.

### 2. Machine Learning Pipeline

O script `train_model.py` processa as dezenas de milhares de linhas de telemetria, aplicando engenharia de features para criar um contexto temporal.

- **Janelas Deslizantes:** Calcula a média e o desvio padrão das últimas 30 leituras de temperatura e vibração para dar "memória" ao modelo.
- **Prevenção de Vazamento (Data Leakage):** Utiliza separação de treino e teste isolando os veículos rigorosamente.
- **Algoritmos:** Exporta modelos treinados de alta precisão (**Random Forest** ou **HistGradientBoosting**) em artefatos `.joblib`.

### 3. API RESTful e Inferência em Tempo Real

O backend (`run.py` e `create_app`) atua como o cérebro operacional em tempo real.

- Recebe pacotes JSON de telemetria.
- Mantém um **buffer temporário na memória RAM** para reconstruir a janela deslizante de 30 leituras por veículo.
- Cruza os dados no `scaler` e aciona a rede neural para classificar o estado do veículo entre **"Operação Normal"** ou **"Alerta: Falha Iminente"**.
- Persiste toda a telemetria e o veredito da IA em um banco de dados relacional (**PostgreSQL**) usando SQLAlchemy.

---

## 🛠️ Tecnologias Utilizadas

- **Linguagem:** Python 3
- **Backend:** Flask, Flask-SQLAlchemy
- **Machine Learning:** scikit-learn, Pandas, NumPy, Joblib
- **Banco de Dados:** PostgreSQL

---

## ⚙️ Pré-requisitos e Configuração

Clone o repositório e instale as dependências:

```bash
pip install -r requirements.txt
```

### Configuração do Banco de Dados

Crie um arquivo `.env` na raiz do projeto com as suas credenciais do banco PostgreSQL:

```env
DATABASE_URL=postgresql://usuario:senha@localhost:5432/fleetguard_db
```

### Geração de Dados e Inicialização

Se for rodar pela primeira vez, você pode gerar a massa de dados sintéticos e carregar o banco:

```bash
# 1. Gere o arquivo fleetguard_dataset_mock.csv
python edge_simulation/generators/fleetguard_mock_generator.py

# 2. Treine o modelo para gerar os arquivos .joblib
python backend_api/ml_pipeline/train_model.py

# 3. Injete os dados simulados na tabela do PostgreSQL
python injetar_dados.py
```

---

## 🚀 Como Executar a API

Para iniciar o servidor Flask em ambiente de desenvolvimento:

```bash
python run.py
```

O servidor estará ativo em [http://127.0.0.1:5000](http://127.0.0.1:5000). O banco de dados e as tabelas `veiculos` e `telemetria` serão criados automaticamente caso não existam.

---

## 📡 Endpoints

### `POST /api/telemetria`

Recebe um pacote de leitura dos sensores do ônibus, processa a previsão temporal e salva o histórico.

**Corpo da Requisição (JSON):**

```json
{
  "veiculo_id": 1,
  "timestamp": 120.5,
  "velocidade_kmh_spn84": 45.2,
  "rpm_spn190": 1500.1,
  "carga_motor_spn92": 45.0,
  "temp_motor_spn110": 89.5,
  "pressao_oleo_spn100": 300.0,
  "vibracao_freio": 0.05,
  "temp_cubo_roda_ir": 33.0,
  "status_porta": "fechada",
  "tensao_bateria_v": 28.2,
  "codigo_erro_scanner": "OK"
}
```

**Resposta de Sucesso:**

```json
{
  "veiculo_id": 1,
  "alerta_preditivo": "Operação Normal",
  "leituras_no_buffer": 30
}
```