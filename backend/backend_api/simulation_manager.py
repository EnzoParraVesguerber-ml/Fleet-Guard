import threading
import os
import requests
import pandas as pd

CSV_PATH = 'backend/edge_simulation/data/fleetguard_dataset_mock.csv'
API_URL = 'http://127.0.0.1:5000/api/telemetria'

_df_cache = None
_df_lock = threading.Lock()


def _load_dataset() -> pd.DataFrame:
    """Carrega o CSV uma única vez e mantém em memória."""
    global _df_cache
    with _df_lock:
        if _df_cache is None:
            print(f"[sim] carregando dataset de {CSV_PATH}")
            _df_cache = pd.read_csv(CSV_PATH)
            print(f"[sim] {len(_df_cache)} linhas em cache")
        return _df_cache


def _to_native(d: dict) -> dict:
    """numpy.int64/float64 -> tipos nativos (JSON-safe)."""
    return {k: (v.item() if hasattr(v, "item") else v) for k, v in d.items()}


class SimulationManager:
    """Mantém no máximo UMA simulação ativa por vez."""

    def __init__(self):
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()
        self._lock = threading.Lock()
        self._veiculo_id: int | None = None
        self._posicao = 0
        self._total = 0
        self._intervalo = 1.0

    def status(self) -> dict:
        with self._lock:
            ativo = self._thread is not None and self._thread.is_alive()
            return {
                "ativo": ativo,
                "veiculo_id": self._veiculo_id,
                "posicao": self._posicao,
                "total": self._total,
                "intervalo_s": self._intervalo,
            }

    def stop(self) -> bool:
        self._stop_event.set()
        t = self._thread
        if t and t.is_alive():
            t.join(timeout=3.0)
        with self._lock:
            self._thread = None
            self._veiculo_id = None
            self._posicao = 0
            self._total = 0
        return True

    def start(self, veiculo_id: int, intervalo_s: float = 1.0, inicio_pct: float | None = None):
        self.stop()  # mata a anterior, se houver

        df = _load_dataset()
        df_bus = df[df['veiculo_id'] == veiculo_id].reset_index(drop=True)
        if df_bus.empty:
            return False, f"Veículo {veiculo_id} não existe no dataset"

        # --- Descobre de onde começar ---
        if inicio_pct is not None:
            start_pos = int(len(df_bus) * inicio_pct)
        elif 'target' in df_bus.columns:
            falha_idx = df_bus.index[df_bus['target'] != "Operação Normal"]
            if len(falha_idx) > 0:
                # começa 60 amostras antes da falha, pra dar tempo da demo mostrar a transição
                start_pos = max(0, int(falha_idx[0]) - 60)
                print(f"[sim] v{veiculo_id} tem falha a partir de {falha_idx[0]}; iniciando em {start_pos}")
            else:
                start_pos = 0
        else:
            start_pos = 0

        self._stop_event = threading.Event()
        with self._lock:
            self._veiculo_id = int(veiculo_id)
            self._posicao = start_pos
            self._total = len(df_bus)
            self._intervalo = float(intervalo_s)

        def _loop():
            for i in range(start_pos, len(df_bus)):
                if self._stop_event.is_set():
                    break
                row = df_bus.iloc[i]
                dados = _to_native(row.to_dict())
                dados.pop('target', None)
                try:
                    requests.post(API_URL, json=dados, timeout=5)
                except Exception as e:
                    print(f"[sim] erro ao postar: {e}")
                with self._lock:
                    self._posicao = i + 1
                if self._stop_event.wait(self._intervalo):
                    break
            print(f"[sim] veículo {veiculo_id} parado em {self._posicao}/{self._total}")

        self._thread = threading.Thread(target=_loop, daemon=True, name=f"sim-v{veiculo_id}")
        self._thread.start()
        return True, None


sim_manager = SimulationManager()