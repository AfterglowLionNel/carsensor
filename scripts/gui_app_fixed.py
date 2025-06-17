#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
修正版GUI中古車分析システム
ウィンドウ表示問題を解決
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

print("=== GUI起動開始 ===")

# プロジェクトルートをパスに追加
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root))

try:
    from src.scraper.car_scraper import CarScraper
    from src.analyzer.grade_normalizer import GradeNormalizer
    print("モジュールインポート成功")
except ImportError as e:
    print(f"モジュールインポートエラー: {e}")
    CarScraper = None
    GradeNormalizer = None

class LogHandler(logging.Handler):
    """GUIログハンドラー"""
    def __init__(self, log_queue):
        super().__init__()
        self.log_queue = log_queue
    
    def emit(self, record):
        try:
            self.log_queue.put(self.format(record))
        except:
            pass

class CarAnalysisGUI:
    def __init__(self, root):
        print("GUI初期化開始")
        self.root = root
        self.root.title("統合中古車分析システム")
        self.root.geometry("900x700")
        
        # ウィンドウを画面中央に配置
        self.root.update_idletasks()
        width = self.root.winfo_width()
        height = self.root.winfo_height()
        x = (self.root.winfo_screenwidth() // 2) - (width // 2)
        y = (self.root.winfo_screenheight() // 2) - (height // 2)
        self.root.geometry(f'{width}x{height}+{x}+{y}')
        
        # ウィンドウを前面に表示
        self.root.lift()
        self.root.attributes('-topmost', True)
        self.root.after_idle(lambda: self.root.attributes('-topmost', False))
        
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
        
        # 初期メッセージ
        self.log_message("システムが正常に起動しました")
        
        print("GUI初期化完了")
        
    def log_message(self, message):
        """ログメッセージを追加"""
        try:
            timestamp = datetime.now().strftime('%H:%M:%S')
            self.log_text.insert(tk.END, f"[{timestamp}] {message}\n")
            self.log_text.see(tk.END)
        except:
            pass
        
    def setup_logging(self):
        """ログ設定"""
        try:
            log_dir = project_root / 'logs'
            log_dir.mkdir(exist_ok=True)
            
            logging.basicConfig(
                level=logging.INFO,
                format='%(asctime)s - %(levelname)s - %(message)s',
                handlers=[
                    logging.FileHandler(log_dir / 'gui.log', encoding='utf-8'),
                    LogHandler(self.log_queue)
                ]
            )
            self.logger = logging.getLogger(__name__)
        except Exception as e:
            print(f"ログ設定エラー: {e}")
            self.logger = logging.getLogger(__name__)
        
    def setup_gui(self):
        """GUI構築"""
        # メインフレーム
        main_frame = ttk.Frame(self.root, padding="15")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # ウィンドウのリサイズ設定
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(1, weight=1)
        main_frame.rowconfigure(3, weight=1)
        
        # タイトル
        title_label = ttk.Label(main_frame, text="🚗 統合中古車分析システム", 
                               font=('Arial', 18, 'bold'))
        title_label.grid(row=0, column=0, columnspan=3, pady=(0, 25))
        
        # 操作選択フレーム
        operation_frame = ttk.LabelFrame(main_frame, text="操作選択", padding="15")
        operation_frame.grid(row=1, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(0, 15))
        
        # ボタン配置
        self.scrape_btn = ttk.Button(operation_frame, text="📥 データスクレイピング", 
                                    command=self.start_scraping, width=20)
        self.scrape_btn.grid(row=0, column=0, padx=(0, 10))
        
        self.analyze_btn = ttk.Button(operation_frame, text="📊 クレンジング&分析", 
                                     command=self.start_analysis, width=20)
        self.analyze_btn.grid(row=0, column=1, padx=(0, 10))
        
        self.refresh_btn = ttk.Button(operation_frame, text="🔄 リスト更新", 
                                     command=self.refresh_car_list, width=15)
        self.refresh_btn.grid(row=0, column=2)
        
        # 車種選択フレーム
        car_frame = ttk.LabelFrame(main_frame, text="車種選択", padding="15")
        car_frame.grid(row=2, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(0, 15))
        car_frame.columnconfigure(0, weight=1)
        
        # 車種リスト
        self.car_listbox = tk.Listbox(car_frame, height=8, font=('Arial', 11))
        self.car_listbox.grid(row=0, column=0, sticky=(tk.W, tk.E), padx=(0, 10))
        
        # スクロールバー
        car_scrollbar = ttk.Scrollbar(car_frame, orient="vertical", command=self.car_listbox.yview)
        car_scrollbar.grid(row=0, column=1, sticky=(tk.N, tk.S))
        self.car_listbox.configure(yscrollcommand=car_scrollbar.set)
        
        # ログ表示フレーム
        log_frame = ttk.LabelFrame(main_frame, text="実行ログ", padding="15")
        log_frame.grid(row=3, column=0, columnspan=3, sticky=(tk.W, tk.E, tk.N, tk.S))
        log_frame.columnconfigure(0, weight=1)
        log_frame.rowconfigure(0, weight=1)
        
        # ログテキストエリア
        self.log_text = scrolledtext.ScrolledText(log_frame, height=12, font=('Consolas', 10))
        self.log_text.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # ステータスバー
        self.status_var = tk.StringVar()
        self.status_var.set("準備完了")
        status_bar = ttk.Label(main_frame, textvariable=self.status_var, 
                              relief=tk.SUNKEN, font=('Arial', 10))
        status_bar.grid(row=4, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(15, 0))
        
    def refresh_car_list(self):
        """車種リスト更新"""
        self.log_message("車種リスト更新中...")
        self.car_listbox.delete(0, tk.END)
        self.available_cars = {}
        
        scraped_dir = project_root / 'data' / 'scraped'
        
        if not scraped_dir.exists():
            self.car_listbox.insert(tk.END, "❌ スクレイピングデータがありません")
            self.log_message("スクレイピングデータディレクトリが存在しません")
            return
        
        car_count = 0
        car_data = {}
        
        for car_dir in scraped_dir.iterdir():
            if not car_dir.is_dir():
                continue
                
            display_name = self.get_display_car_name(car_dir.name)
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
            self.available_cars[car_count] = info
            car_count += 1
        
        if car_count == 0:
            self.car_listbox.insert(tk.END, "❌ 利用可能な車種データがありません")
            self.log_message("利用可能な車種データがありません")
        else:
            self.log_message(f"車種リスト更新完了: {car_count}車種")
            
        self.status_var.set(f"車種リスト更新完了: {car_count}車種")
        
    def get_display_car_name(self, folder_name):
        """表示用車種名取得（RC F の特別処理）"""
        if folder_name.upper() in ['F', 'RC_F', 'RCF']:
            return "RC F"
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
            
        if not messagebox.askyesno("確認", "データスクレイピングを開始しますか？\n(urls.txt に設定されたURLから取得します)"):
            return
            
        self.current_operation = "scraping"
        self.disable_buttons()
        self.status_var.set("スクレイピング実行中...")
        self.log_message("スクレイピング開始")
        
        # バックグラウンドで実行
        thread = threading.Thread(target=self.run_scraping)
        thread.daemon = True
        thread.start()
        
    def run_scraping(self):
        """スクレイピング実行（バックグラウンド）"""
        try:
            if CarScraper is None:
                raise Exception("CarScraperモジュールが利用できません")
                
            scraper = CarScraper()
            results = scraper.run_from_urls_file(str(project_root / 'urls.txt'))
            
            self.root.after(0, self.scraping_completed, results)
            
        except Exception as e:
            self.root.after(0, self.operation_failed, f"スクレイピングエラー: {e}")
            
    def scraping_completed(self, results):
        """スクレイピング完了処理"""
        self.current_operation = None
        self.enable_buttons()
        
        if results:
            self.status_var.set(f"スクレイピング完了: {len(results)}ファイル生成")
            self.log_message(f"スクレイピング完了: {len(results)}ファイル生成")
            messagebox.showinfo("完了", f"スクレイピングが完了しました。\n{len(results)}ファイルが生成されました。")
            self.refresh_car_list()
        else:
            self.status_var.set("スクレイピング失敗")
            self.log_message("スクレイピング失敗: データを取得できませんでした")
            messagebox.showerror("エラー", "スクレイピングでデータを取得できませんでした。")
            
    def start_analysis(self):
        """分析開始"""
        if self.current_operation:
            messagebox.showwarning("警告", "他の処理が実行中です")
            return
            
        selection = self.car_listbox.curselection()
        if not selection:
            messagebox.showwarning("警告", "分析する車種を選択してください")
            return
            
        selected_index = selection[0]
        if selected_index not in self.available_cars:
            messagebox.showwarning("警告", "有効な車種を選択してください")
            return
            
        car_info = self.available_cars[selected_index]
        
        if not messagebox.askyesno("確認", f"'{car_info['display_name']}' のクレンジング&分析を開始しますか？"):
            return
            
        self.current_operation = "analysis"
        self.disable_buttons()
        self.status_var.set(f"{car_info['display_name']} を分析中...")
        self.log_message(f"{car_info['display_name']} の分析を開始")
        
        # バックグラウンドで実行
        thread = threading.Thread(target=self.run_analysis, args=(car_info,))
        thread.daemon = True
        thread.start()
        
    def run_analysis(self, car_info):
        """分析実行（バックグラウンド）"""
        try:
            if GradeNormalizer is None:
                raise Exception("GradeNormalizerモジュールが利用できません")
                
            target_file = car_info['latest_file']
            
            # データ読み込み
            if target_file.suffix.lower() == '.csv':
                df = pd.read_csv(target_file, encoding='utf-8-sig')
            elif target_file.suffix.lower() in ['.xlsx', '.xls']:
                df = pd.read_excel(target_file)
            else:
                raise ValueError(f"サポートされていないファイル形式: {target_file.suffix}")
            
            # グレード正規化
            normalizer = GradeNormalizer()
            normalized_df = normalizer.normalize_dataframe(df)
            
            # 分析結果保存
            output_path = self.save_analysis_result(normalized_df, target_file, car_info['display_name'])
            
            # レポート生成
            report = normalizer.get_normalization_report(normalized_df)
            
            self.root.after(0, self.analysis_completed, output_path, report, car_info['display_name'])
            
        except Exception as e:
            self.root.after(0, self.operation_failed, f"分析エラー: {e}")
    
    def save_analysis_result(self, df, source_file, car_display_name):
        """分析結果保存"""
        output_dir = project_root / 'data' / 'normalized'
        output_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_filename = f"{car_display_name}_normalized_{timestamp}.xlsx"
        safe_filename = re.sub(r'[\\|/|:|*|?|"|<|>|\|]', '_', output_filename)
        output_path = output_dir / safe_filename
        
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='正規化済みデータ', index=False)
            
            if '正規グレード' in df.columns:
                grade_summary = df.groupby('正規グレード').agg({
                    '支払総額': lambda x: self.extract_price_stats(x)
                }).round(2)
                
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
        self.log_message(f"{car_name} の分析が完了しました")
        
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
        self.log_message(f"操作失敗: {error_message}")
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

def main():
    """メイン関数"""
    print("=== メイン関数開始 ===")
    
    try:
        # tkinterルートウィンドウ作成
        root = tk.Tk()
        print("ルートウィンドウ作成成功")
        
        # ウィンドウが閉じられるまで待機させる
        root.protocol("WM_DELETE_WINDOW", lambda: (print("ウィンドウ閉じるボタンが押されました"), root.quit()))
        
        # アプリケーション初期化
        app = CarAnalysisGUI(root)
        print("アプリケーション初期化完了")
        
        # ウィンドウを表示
        root.deiconify()  # ウィンドウを明示的に表示
        root.focus_force()  # フォーカスを強制取得
        
        print("=== メインループ開始 ===")
        
        # メインループ開始（明示的にtry-except）
        try:
            root.mainloop()
        except KeyboardInterrupt:
            print("Ctrl+C で中断されました")
        except Exception as e:
            print(f"メインループエラー: {e}")
        
        print("=== メインループ終了 ===")
        
    except Exception as e:
        print(f"メイン関数でエラー: {e}")
        import traceback
        traceback.print_exc()
        input("エラー詳細を確認してからEnterを押してください...")

if __name__ == '__main__':
    main()