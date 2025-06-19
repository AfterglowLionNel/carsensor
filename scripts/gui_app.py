#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GUI版統合中古車分析システム
tkinterベースのGUIアプリケーション
"""

import sys
import os
import re
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
import pandas as pd
import logging
from pathlib import Path
from datetime import datetime
import threading
import queue

# プロジェクトルートをパスに追加
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root))

from src.scraper.car_scraper import CarScraper
from src.analyzer.grade_normalizer import GradeNormalizer

class LogHandler(logging.Handler):
    """GUIログハンドラー"""
    def __init__(self, log_queue):
        super().__init__()
        self.log_queue = log_queue
    
    def emit(self, record):
        self.log_queue.put(self.format(record))

class CarAnalysisGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("統合中古車分析システム")
        self.root.geometry("800x600")
        
        # ログキュー
        self.log_queue = queue.Queue()
        self.setup_logging()
        
        # データ格納
        self.available_cars = {}
        self.current_operation = None
        
        # GUI構築
        self.setup_gui()
        self.refresh_car_list()
        
        # ログ更新タイマー
        self.update_log_display()
        
    def setup_logging(self):
        """ログ設定"""
        log_dir = project_root / 'logs'
        log_dir.mkdir(exist_ok=True)
        
        # ルートロガー設定
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_dir / 'gui.log', encoding='utf-8'),
                LogHandler(self.log_queue)
            ]
        )
        self.logger = logging.getLogger(__name__)
        
    def setup_gui(self):
        """GUI構築"""
        # メインフレーム
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # ウィンドウのリサイズ設定
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(1, weight=1)
        main_frame.rowconfigure(3, weight=1)
        
        # タイトル
        title_label = ttk.Label(main_frame, text="🚗 統合中古車分析システム", 
                               font=('Arial', 16, 'bold'))
        title_label.grid(row=0, column=0, columnspan=3, pady=(0, 20))
        
        # 操作選択フレーム
        operation_frame = ttk.LabelFrame(main_frame, text="操作選択", padding="10")
        operation_frame.grid(row=1, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(0, 10))
        
        # スクレイピングボタン
        self.scrape_btn = ttk.Button(operation_frame, text="📥 データスクレイピング", 
                                    command=self.start_scraping, width=18)
        self.scrape_btn.grid(row=0, column=0, padx=(0, 5))
        
        # 分析ボタン
        self.analyze_btn = ttk.Button(operation_frame, text="📊 クレンジング&分析", 
                                     command=self.start_analysis, width=18)
        self.analyze_btn.grid(row=0, column=1, padx=(0, 5))
        
        # React分析ボタン
        self.react_btn = ttk.Button(operation_frame, text="🌐 React分析ダッシュボード", 
                                   command=self.start_react_dashboard, width=20)
        self.react_btn.grid(row=0, column=2, padx=(0, 5))
        
        # 更新ボタン
        self.refresh_btn = ttk.Button(operation_frame, text="🔄 リスト更新", 
                                     command=self.refresh_car_list, width=12)
        self.refresh_btn.grid(row=0, column=3)
        
        # 車種選択フレーム
        car_frame = ttk.LabelFrame(main_frame, text="車種選択", padding="10")
        car_frame.grid(row=2, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(0, 10))
        car_frame.columnconfigure(0, weight=1)
        
        # 車種リスト
        self.car_listbox = tk.Listbox(car_frame, height=6, font=('Arial', 10))
        self.car_listbox.grid(row=0, column=0, sticky=(tk.W, tk.E))
        
        # スクロールバー
        car_scrollbar = ttk.Scrollbar(car_frame, orient="vertical", command=self.car_listbox.yview)
        car_scrollbar.grid(row=0, column=1, sticky=(tk.N, tk.S))
        self.car_listbox.configure(yscrollcommand=car_scrollbar.set)
        
        # ログ表示フレーム
        log_frame = ttk.LabelFrame(main_frame, text="実行ログ", padding="10")
        log_frame.grid(row=3, column=0, columnspan=3, sticky=(tk.W, tk.E, tk.N, tk.S))
        log_frame.columnconfigure(0, weight=1)
        log_frame.rowconfigure(0, weight=1)
        
        # ログテキストエリア
        self.log_text = scrolledtext.ScrolledText(log_frame, height=15, font=('Consolas', 9))
        self.log_text.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # ステータスバー
        self.status_var = tk.StringVar()
        self.status_var.set("準備完了")
        status_bar = ttk.Label(main_frame, textvariable=self.status_var, 
                              relief=tk.SUNKEN, font=('Arial', 9))
        status_bar.grid(row=4, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(10, 0))
        
    def refresh_car_list(self):
        """車種リスト更新"""
        self.car_listbox.delete(0, tk.END)
        self.available_cars = {}
        
        # Determine scraped data directory. Prefer 'data/scraped' at the
        # project root, but fall back to the bundled sample data under
        # src/scraper if the directory doesn't exist.
        from src.utils import get_scraped_dir
        scraped_dir = get_scraped_dir(project_root)
        if not scraped_dir.exists():
            self.car_listbox.insert(tk.END, "スクレイピングデータがありません")
            return
        
        car_data = {}
        
        for car_dir in scraped_dir.iterdir():
            if not car_dir.is_dir():
                continue
                
            # RC F の特別処理
            display_name = self.get_display_car_name(car_dir.name)
            
            # 各車種の最新ファイル情報を取得
            latest_file = self.get_latest_file_for_car(car_dir)
            if latest_file:
                file_count = self.count_files_for_car(car_dir)
                car_data[display_name] = {
                    'folder_name': car_dir.name,
                    'latest_file': latest_file,
                    'file_count': file_count,
                    'display_name': display_name
                }
        
        # 車種をソートして表示
        for display_name in sorted(car_data.keys()):
            info = car_data[display_name]
            list_text = f"🚗 {display_name} ({info['file_count']}ファイル) - 最新: {info['latest_file'].name}"
            self.car_listbox.insert(tk.END, list_text)
            self.available_cars[len(self.available_cars)] = info
        
        if not car_data:
            self.car_listbox.insert(tk.END, "利用可能な車種データがありません")
            
        self.status_var.set(f"車種リスト更新完了: {len(car_data)}車種")
        
    def get_display_car_name(self, folder_name):
        """表示用車種名取得（RC F の特別処理）"""
        # RC F の特別処理
        if folder_name.upper() in ['F', 'RC_F', 'RCF']:
            return "RC F"
        
        # その他の車種はそのまま
        return folder_name
        
    def get_latest_file_for_car(self, car_dir):
        """指定車種の最新ファイル取得（No が最大のもの）"""
        all_files = []
        
        for date_dir in car_dir.iterdir():
            if date_dir.is_dir():
                csv_files = list(date_dir.glob('*.csv'))
                all_files.extend(csv_files)
        
        if not all_files:
            return None
        
        # ファイル名からNo番号を抽出してソート
        def get_file_number(file_path):
            match = re.search(r'\.No(\d+)\.csv$', file_path.name)
            return int(match.group(1)) if match else 0
        
        # 同じ日付の中で最大のNo、異なる日付では最新の日付
        latest_file = max(all_files, key=lambda f: (f.stat().st_mtime, get_file_number(f)))
        return latest_file
        
    def count_files_for_car(self, car_dir):
        """指定車種のファイル数カウント"""
        count = 0
        for date_dir in car_dir.iterdir():
            if date_dir.is_dir():
                count += len(list(date_dir.glob('*.csv')))
        return count
        
    def start_scraping(self):
        """スクレイピング開始"""
        if self.current_operation:
            messagebox.showwarning("警告", "他の処理が実行中です")
            return
            
        # 確認ダイアログ
        if not messagebox.askyesno("確認", "データスクレイピングを開始しますか？\n(urls.txt に設定されたURLから取得します)"):
            return
            
        self.current_operation = "scraping"
        self.disable_buttons()
        self.status_var.set("スクレイピング実行中...")
        
        # バックグラウンドで実行
        thread = threading.Thread(target=self.run_scraping)
        thread.daemon = True
        thread.start()
        
    def run_scraping(self):
        """スクレイピング実行（バックグラウンド）"""
        try:
            scraper = CarScraper()
            results = scraper.run_from_urls_file(str(project_root / 'urls.txt'))
            
            # UI更新（メインスレッドで実行）
            self.root.after(0, self.scraping_completed, results)
            
        except Exception as e:
            self.logger.error(f"スクレイピングエラー: {e}")
            self.root.after(0, self.operation_failed, f"スクレイピングエラー: {e}")
            
    def scraping_completed(self, results):
        """スクレイピング完了処理"""
        self.current_operation = None
        self.enable_buttons()
        
        if results:
            self.status_var.set(f"スクレイピング完了: {len(results)}ファイル生成")
            messagebox.showinfo("完了", f"スクレイピングが完了しました。\n{len(results)}ファイルが生成されました。")
            self.refresh_car_list()
        else:
            self.status_var.set("スクレイピング失敗")
            messagebox.showerror("エラー", "スクレイピングでデータを取得できませんでした。")
            
    def start_analysis(self):
        """分析開始"""
        if self.current_operation:
            messagebox.showwarning("警告", "他の処理が実行中です")
            return
            
        # 車種選択確認
        selection = self.car_listbox.curselection()
        if not selection:
            messagebox.showwarning("警告", "分析する車種を選択してください")
            return
            
        selected_index = selection[0]
        if selected_index not in self.available_cars:
            messagebox.showwarning("警告", "有効な車種を選択してください")
            return
            
        car_info = self.available_cars[selected_index]
        
        # 確認ダイアログ
        if not messagebox.askyesno("確認", f"'{car_info['display_name']}' のクレンジング&分析を開始しますか？"):
            return
            
        self.current_operation = "analysis"
        self.disable_buttons()
        self.status_var.set(f"{car_info['display_name']} を分析中...")
        
        # バックグラウンドで実行
        thread = threading.Thread(target=self.run_analysis, args=(car_info,))
        thread.daemon = True
        thread.start()
        
    def run_analysis(self, car_info):
        """分析実行（バックグラウンド）"""
        try:
            target_file = car_info['latest_file']
            
            # データ読み込み
            if target_file.suffix.lower() == '.csv':
                df = pd.read_csv(target_file, encoding='utf-8-sig')
            elif target_file.suffix.lower() in ['.xlsx', '.xls']:
                df = pd.read_excel(target_file)
            else:
                raise ValueError(f"サポートされていないファイル形式: {target_file.suffix}")
            
            self.logger.info(f"データ読み込み完了: {len(df)}件")
            
            # グレード正規化
            normalizer = GradeNormalizer()
            normalized_df = normalizer.normalize_dataframe(df)
            
            # 分析結果保存
            output_path = self.save_analysis_result(normalized_df, target_file, car_info['display_name'])
            
            # レポート生成
            report = normalizer.get_normalization_report(normalized_df)
            
            # UI更新（メインスレッドで実行）
            self.root.after(0, self.analysis_completed, output_path, report, car_info['display_name'])
            
        except Exception as e:
            self.logger.error(f"分析エラー: {e}")
            self.root.after(0, self.operation_failed, f"分析エラー: {e}")
            
    def save_analysis_result(self, df, source_file, car_display_name):
        """分析結果保存"""
        # 出力ディレクトリ
        output_dir = project_root / 'data' / 'normalized'
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # ファイル名生成（表示名を使用）
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_filename = f"{car_display_name}_normalized_{timestamp}.xlsx"
        # ファイル名として使用できない文字を処理
        safe_filename = re.sub(r'[\\|/|:|*|?|"|<|>|\|]', '_', output_filename)
        output_path = output_dir / safe_filename
        
        # Excel保存（複数シート）
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # 正規化済みデータ
            df.to_excel(writer, sheet_name='正規化済みデータ', index=False)
            
            # グレード別集計
            if '正規グレード' in df.columns:
                grade_summary = df.groupby('正規グレード').agg({
                    '支払総額': lambda x: self.extract_price_stats(x)
                }).round(2)
                
                # 集計結果を展開
                grade_stats = []
                for grade, stats in grade_summary.iterrows():
                    price_data = stats['支払総額']
                    if isinstance(price_data, dict):
                        grade_stats.append({
                            'グレード': grade,
                            '平均価格': price_data.get('平均', 0),
                            '最小価格': price_data.get('最小', 0),
                            '最大価格': price_data.get('最大', 0),
                            'データ件数': price_data.get('件数', 0)
                        })
                
                if grade_stats:
                    grade_df = pd.DataFrame(grade_stats)
                    grade_df.to_excel(writer, sheet_name='グレード別集計', index=False)
            
            # メタデータ
            metadata = {
                'ソースファイル': str(source_file),
                '車種名': car_display_name,
                '処理日時': datetime.now().isoformat(),
                '総件数': len(df),
                '正規グレード数': df['正規グレード'].nunique() if '正規グレード' in df.columns else 0
            }
            metadata_df = pd.DataFrame([metadata])
            metadata_df.to_excel(writer, sheet_name='メタデータ', index=False)
        
        return output_path
        
    def extract_price_stats(self, price_series):
        """価格統計計算"""
        values = []
        for price in price_series:
            if pd.isna(price):
                continue
            match = re.search(r'([0-9.]+)万円', str(price))
            if match:
                values.append(float(match.group(1)))
        
        if values:
            import numpy as np
            return {
                '平均': np.mean(values),
                '最小': np.min(values),
                '最大': np.max(values),
                '件数': len(values)
            }
        return {'平均': 0, '最小': 0, '最大': 0, '件数': 0}
        
    def analysis_completed(self, output_path, report, car_name):
        """分析完了処理"""
        self.current_operation = None
        self.enable_buttons()
        
        self.status_var.set(f"{car_name} の分析完了")
        
        # 結果表示
        message = f"'{car_name}' の分析が完了しました。\n\n"
        message += f"出力ファイル: {output_path.name}\n\n"
        
        if report:
            message += "📊 分析結果:\n"
            message += f"総データ数: {report['total_count']:,}件\n"
            message += f"正規グレード数: {report['unique_normalized_grades']}種類\n"
            
            quality = report.get('matching_quality', {})
            message += f"高精度マッチング: {quality.get('high_confidence', 0)}件\n"
            message += f"中精度マッチング: {quality.get('medium_confidence', 0)}件\n"
            message += f"低精度マッチング: {quality.get('low_confidence', 0)}件\n"
        
        messagebox.showinfo("分析完了", message)
        
    def operation_failed(self, error_message):
        """操作失敗処理"""
        self.current_operation = None
        self.enable_buttons()
        self.status_var.set("操作失敗")
        messagebox.showerror("エラー", error_message)
        
    def disable_buttons(self):
        """ボタン無効化"""
        self.scrape_btn.configure(state='disabled')
        self.analyze_btn.configure(state='disabled')
        self.refresh_btn.configure(state='disabled')
        
    def enable_buttons(self):
        """ボタン有効化"""
        self.scrape_btn.configure(state='normal')
        self.analyze_btn.configure(state='normal')
        self.refresh_btn.configure(state='normal')
        
    def update_log_display(self):
        """ログ表示更新"""
        try:
            while True:
                log_message = self.log_queue.get_nowait()
                self.log_text.insert(tk.END, log_message + '\n')
                self.log_text.see(tk.END)
        except queue.Empty:
            pass
        
        # 100ms後に再実行
        self.root.after(100, self.update_log_display)
def start_react_dashboard(self):
        """React分析ダッシュボードを起動"""
        if self.current_operation:
            messagebox.showwarning("警告", "他の処理が実行中です")
            return
        
        try:
            # 正規化済みデータファイルをweb/publicにコピー
            self.prepare_react_data()
            
            # React開発サーバー起動
            self.launch_react_server()
            
        except Exception as e:
            messagebox.showerror("エラー", f"React ダッシュボード起動エラー: {e}")
    
def prepare_react_data(self):
    """React用データ準備"""
    import shutil
    
    # web/public/data ディレクトリ確認・作成
    web_data_dir = project_root / 'web' / 'public' / 'data'
    web_data_dir.mkdir(parents=True, exist_ok=True)
    
    # 正規化済みデータをコピー
    normalized_dir = project_root / 'data' / 'normalized'
    if normalized_dir.exists():
        for excel_file in normalized_dir.glob('*.xlsx'):
            # ExcelをCSVに変換してコピー
            try:
                import pandas as pd
                df = pd.read_excel(excel_file, sheet_name='正規化済みデータ')
                csv_filename = excel_file.stem + '.csv'
                csv_path = web_data_dir / csv_filename
                df.to_csv(csv_path, index=False, encoding='utf-8-sig')
                self.logger.info(f"React用データ準備: {csv_filename}")
            except Exception as e:
                self.logger.warning(f"ファイル変換エラー {excel_file}: {e}")
    
    # サンプルデータも作成（データがない場合）
    import pandas as pd
    sample_data = [
        {
            '車種名': 'GRヤリス',
            'グレード': 'RZ ハイパフォーマンス',
            '正規グレード': 'RZ ハイパフォーマンス',
            '支払総額': '450万円',
            '年式': '2024(R06)',
            '走行距離': '0.5万km',
            '修復歴': 'なし',
            'ミッション': 'フロア6MT',
            '排気量': '1600CC',
            'マッチング精度': 0.95,
            '取得日時': '2024-06-17'
        }
    ]
    
    sample_df = pd.DataFrame(sample_data)
    sample_path = web_data_dir / 'sample_data.csv'
    sample_df.to_csv(sample_path, index=False, encoding='utf-8-sig')
    
    self.logger.info("React用データ準備完了")

def launch_react_server(self):
    """React開発サーバー起動"""
    import subprocess
    import webbrowser
    import os
    
    web_dir = project_root / 'web'
    
    # package.json確認
    if not (web_dir / 'package.json').exists():
        # 基本的なpackage.jsonとvite.config.js作成
        self.create_react_config()
    
    try:
        # npm install 確認
        if not (web_dir / 'node_modules').exists():
            messagebox.showinfo("初回セットアップ", "初回起動のため、依存関係をインストールします。\n少し時間がかかる場合があります。")
            
            # 別ウィンドウでnpm install実行
            install_process = subprocess.Popen(
                ['npm', 'install'],
                cwd=str(web_dir),
                creationflags=subprocess.CREATE_NEW_CONSOLE if os.name == 'nt' else 0
            )
            
            # インストール完了まで待機
            install_process.wait()
            
            if install_process.returncode != 0:
                raise Exception("npm install が失敗しました")
        
        # React開発サーバー起動
        messagebox.showinfo("ダッシュボード起動", "React分析ダッシュボードを起動します。\nブラウザが自動で開きます。")
        
        # バックグラウンドでサーバー起動
        dev_process = subprocess.Popen(
            ['npm', 'run', 'dev'],
            cwd=str(web_dir),
            creationflags=subprocess.CREATE_NEW_CONSOLE if os.name == 'nt' else 0
        )
        
        # 数秒待ってからブラウザを開く
        import time
        time.sleep(3)
        webbrowser.open('http://localhost:5173')
        
        self.logger.info("React ダッシュボード起動完了")
        
    except FileNotFoundError:
        messagebox.showerror("エラー", "Node.js/npmがインストールされていません。\nNode.jsをインストールしてから再度お試しください。")
    except Exception as e:
        messagebox.showerror("エラー", f"React サーバー起動エラー: {e}")

def create_react_config(self):
    """React設定ファイル作成"""
    web_dir = project_root / 'web'
    
    # package.json
    package_json = {
        "name": "car-analysis-dashboard",
        "private": True,
        "version": "1.0.0",
        "type": "module",
        "scripts": {
            "dev": "vite",
            "build": "vite build",
            "preview": "vite preview"
        },
        "dependencies": {
            "react": "^18.2.0",
            "react-dom": "^18.2.0",
            "recharts": "^2.8.0",
            "papaparse": "^5.4.1"
        },
        "devDependencies": {
            "@types/react": "^18.2.43",
            "@types/react-dom": "^18.2.17",
            "@vitejs/plugin-react": "^4.2.1",
            "vite": "^5.0.8"
        }
    }
    
    import json
    with open(web_dir / 'package.json', 'w', encoding='utf-8') as f:
        json.dump(package_json, f, indent=2)
    
    # vite.config.js
    vite_config = '''import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
plugins: [react()],
server: {
port: 5173,
open: false
}
})
'''
    
    with open(web_dir / 'vite.config.js', 'w', encoding='utf-8') as f:
        f.write(vite_config)
    
    # index.html
    index_html = '''<!doctype html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>中古車価格分析ダッシュボード</title>
<script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
<div id="root"></div>
<script type="module" src="/src/main.jsx"></script>
</body>
</html>
'''
    
    with open(web_dir / 'index.html', 'w', encoding='utf-8') as f:
        f.write(index_html)
    
    # src/main.jsx
    src_dir = web_dir / 'src'
    src_dir.mkdir(exist_ok=True)
    
    main_jsx = '''import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
<React.StrictMode>
<App />
</React.StrictMode>,
)
'''
    
    with open(src_dir / 'main.jsx', 'w', encoding='utf-8') as f:
        f.write(main_jsx)
    
    self.logger.info("React設定ファイル作成完了")

def main():
    """メイン関数"""
    root = tk.Tk()
    app = CarAnalysisGUI(root)

    try:
        root.mainloop()
    except KeyboardInterrupt:
        print("アプリケーションを終了します")

    if __name__ == '__main__':
        main()