#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
グレード正規化エンジン
JSON設定による高精度グレードクリーニング
"""

import json
import pandas as pd
import re
import os
from pathlib import Path
from typing import List, Dict, Tuple
from difflib import SequenceMatcher
import logging

class GradeNormalizer:
    def __init__(self, grades_json_path="config\\car_grades.json"):
        self.grades_json_path = Path(grades_json_path)
        self.car_grades_db = {}
        self.exclude_keywords = []
        
        self.logger = logging.getLogger(__name__)
        self.load_configuration()
    
    def load_configuration(self):
        """設定読み込み"""
        self.load_grades_database()
        self.load_exclude_keywords()
    
    def load_grades_database(self):
        """正規グレードデータベース読み込み"""
        try:
            if self.grades_json_path.exists():
                with open(self.grades_json_path, 'r', encoding='utf-8') as f:
                    grades_data = json.load(f)
                
                self.car_grades_db = {}
                for car_info in grades_data:
                    car_name = car_info['car_name']
                    self.car_grades_db[car_name] = {
                        'grades': car_info['grades'],
                        'aliases': car_info.get('aliases', []),
                        'special_patterns': car_info.get('special_patterns', {})
                    }
                
                self.logger.info(f"正規グレードDB読み込み: {len(self.car_grades_db)}車種")
            else:
                self.logger.warning(f"正規グレードファイルが見つかりません: {self.grades_json_path}")
                
        except Exception as e:
            self.logger.error(f"正規グレードDB読み込みエラー: {e}")
            self.car_grades_db = {}
    
    def load_exclude_keywords(self):
        """除外キーワード読み込み"""
        keywords_file = Path("config\\exclude_keywords.txt")
        
        try:
            if keywords_file.exists():
                with open(keywords_file, 'r', encoding='utf-8') as f:
                    self.exclude_keywords = [line.strip() for line in f 
                                           if line.strip() and not line.startswith('#')]
                self.logger.info(f"除外キーワード読み込み: {len(self.exclude_keywords)}件")
            else:
                self.logger.warning("除外キーワードファイルが見つかりません")
                self.exclude_keywords = []
                
        except Exception as e:
            self.logger.error(f"除外キーワード読み込みエラー: {e}")
            self.exclude_keywords = []
    
    def clean_grade_text(self, grade_text):
        """グレードテキストクリーニング"""
        if not grade_text:
            return ""
        
        cleaned = grade_text
        
        # 除外キーワードの削除
        for keyword in self.exclude_keywords:
            pattern = rf'\b{re.escape(keyword)}\b'
            cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)
        
        # 不要文字の削除
        cleaned = re.sub(r'[（）\(\)\[\]【】]', '', cleaned)
        cleaned = re.sub(r'[・／/\-_]', ' ', cleaned)
        cleaned = re.sub(r'\s+', ' ', cleaned)
        cleaned = cleaned.strip()
        
        return cleaned
    
    def extract_core_grade(self, grade_text, car_name=None):
        """コアグレード抽出"""
        cleaned = self.clean_grade_text(grade_text)
        
        # 車種固有の特殊パターン
        if car_name and car_name in self.car_grades_db:
            special_patterns = self.car_grades_db[car_name].get('special_patterns', {})
            for pattern, normalized in special_patterns.items():
                if pattern.lower() in cleaned.lower():
                    return normalized
        
        # パターンマッチング
        patterns = [
            (r'(\d+\.\d+)\s+(R[A-Z]+|[A-Z]+)', lambda m: m.group(2).upper()),
            (r'(HYBRID\s+[A-Z]+)', lambda m: m.group(1).upper()),
            (r'(Custom\s+[A-Z]+)', lambda m: m.group(1).title()),
            (r'\b(R[A-Z]|GT|STI|EX|L|G|S|Z|X|RS)\b', lambda m: m.group(1).upper()),
            (r'\b(\d+\.\d+[LT]?)\b', lambda m: m.group(1))
        ]
        
        for pattern, transformer in patterns:
            match = re.search(pattern, cleaned, re.IGNORECASE)
            if match:
                return transformer(match)
        
        # 特殊グレード
        special_grades = [
            ('ハイパフォーマンス', 'ハイパフォーマンス'),
            ('ハイ パフォーマンス', 'ハイパフォーマンス'),
            ('スポーツ', 'Sport'),
            ('ターボ', 'ターボ'),
            ('モノトーン', 'モノトーン'),
            ('2トーン', '2トーン')
        ]
        
        for pattern, normalized in special_grades:
            if pattern in cleaned:
                return normalized
        
        # 最初の単語
        words = cleaned.split()
        return words[0] if words else 'ベース'
    
    def similarity_score(self, text1, text2):
        """文字列類似度計算"""
        return SequenceMatcher(None, text1.lower(), text2.lower()).ratio()
    
    def normalize_car_name(self, car_name):
        """車種名正規化（エイリアス対応）"""
        if not car_name:
            return ""
        
        if car_name in self.car_grades_db:
            return car_name
        
        # エイリアスチェック
        for norm_name, car_info in self.car_grades_db.items():
            aliases = car_info.get('aliases', [])
            if car_name in aliases:
                return norm_name
            
            for alias in aliases:
                if car_name.lower() in alias.lower() or alias.lower() in car_name.lower():
                    return norm_name
        
        return car_name
    
    def find_best_grade_match(self, input_grade, car_name):
        """最適グレードマッチング"""
        normalized_car_name = self.normalize_car_name(car_name)
        
        if normalized_car_name not in self.car_grades_db:
            core_grade = self.extract_core_grade(input_grade, car_name)
            return core_grade, 0.0
        
        car_info = self.car_grades_db[normalized_car_name]
        official_grades = car_info['grades']
        cleaned_input = self.clean_grade_text(input_grade)
        core_grade = self.extract_core_grade(input_grade, normalized_car_name)
        
        best_match = core_grade
        best_score = 0.0
        
        for official_grade in official_grades:
            # 完全一致
            if cleaned_input.lower() == official_grade.lower():
                return official_grade, 1.0
            
            # コアグレード完全一致
            if core_grade.lower() == official_grade.lower():
                return official_grade, 0.95
            
            # 部分一致
            if core_grade.lower() in official_grade.lower():
                score = self.similarity_score(cleaned_input, official_grade)
                if score > best_score:
                    best_match = official_grade
                    best_score = score
            
            # 逆方向部分一致
            if official_grade.lower() in cleaned_input.lower():
                score = self.similarity_score(cleaned_input, official_grade)
                if score > best_score:
                    best_match = official_grade
                    best_score = score
            
            # 類似度チェック
            score = self.similarity_score(cleaned_input, official_grade)
            if score > best_score and score > 0.6:
                best_match = official_grade
                best_score = score
        
        return best_match, best_score
    
    def normalize_dataframe(self, df):
        """DataFrameグレード正規化"""
        if df is None or df.empty:
            self.logger.warning("空のDataFrameです")
            return df
        
        if 'グレード' not in df.columns:
            self.logger.warning("'グレード'列が見つかりません")
            return df
        
        self.logger.info("グレード正規化開始...")
        
        result_df = df.copy()
        normalized_grades = []
        match_scores = []
        original_grades = []
        
        # 車種名取得
        car_name = df['車種名'].iloc[0] if '車種名' in df.columns else "Unknown"
        
        for idx, grade in enumerate(df['グレード']):
            if pd.isna(grade):
                normalized_grade = 'ベース'
                score = 0.0
                original_grade = ''
            else:
                original_grade = str(grade)
                normalized_grade, score = self.find_best_grade_match(original_grade, car_name)
            
            normalized_grades.append(normalized_grade)
            match_scores.append(score)
            original_grades.append(original_grade)
            
            if (idx + 1) % 100 == 0:
                self.logger.info(f"正規化進捗: {idx + 1}/{len(df)}")
        
        # 新列追加
        result_df['元グレード'] = original_grades
        result_df['正規グレード'] = normalized_grades
        result_df['マッチング精度'] = match_scores
        
        # 統計
        high_confidence = sum(1 for s in match_scores if s >= 0.8)
        medium_confidence = sum(1 for s in match_scores if 0.6 <= s < 0.8)
        low_confidence = sum(1 for s in match_scores if s < 0.6)
        
        self.logger.info(f"正規化完了:")
        self.logger.info(f"  高精度(≥80%): {high_confidence}件")
        self.logger.info(f"  中精度(60-80%): {medium_confidence}件")
        self.logger.info(f"  低精度(<60%): {low_confidence}件")
        
        return result_df
    
    def get_normalization_report(self, df):
        """正規化レポート生成"""
        if '正規グレード' not in df.columns:
            return {}
        
        total_count = len(df)
        unique_original = df['元グレード'].nunique() if '元グレード' in df.columns else 0
        unique_normalized = df['正規グレード'].nunique()
        
        scores = df['マッチング精度'].values
        high_confidence = sum(1 for s in scores if s >= 0.8)
        medium_confidence = sum(1 for s in scores if 0.6 <= s < 0.8)
        low_confidence = sum(1 for s in scores if s < 0.6)
        
        grade_counts = df['正規グレード'].value_counts().to_dict()
        
        mapping_examples = {}
        if '元グレード' in df.columns:
            mapping_examples = df.groupby(['元グレード', '正規グレード']).size().sort_values(ascending=False).head(10).to_dict()
        
        return {
            'total_count': total_count,
            'unique_original_grades': unique_original,
            'unique_normalized_grades': unique_normalized,
            'matching_quality': {
                'high_confidence': high_confidence,
                'medium_confidence': medium_confidence,
                'low_confidence': low_confidence
            },
            'grade_distribution': grade_counts,
            'mapping_examples': mapping_examples
        }