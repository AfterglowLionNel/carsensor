/**
 * データ処理ユーティリティ（修正版）
 * 価格の型変換バグとミッション分類を修正
 */

/**
 * 価格文字列から数値を抽出（型安全版）
 * @param {string|number} priceStr - "659.9万円" 形式の文字列または数値
 * @returns {number|null} 数値または null
 */
export const parsePrice = (priceStr) => {
  // 既に数値の場合
  if (typeof priceStr === 'number') {
    return priceStr;
  }
  
  if (!priceStr || typeof priceStr !== 'string') return null;
  
  // "659.9万円" -> 659.9
  const match = priceStr.match(/([0-9.]+)万円/);
  if (match) {
    const price = parseFloat(match[1]);
    // 価格範囲チェック（10万円～3000万円の範囲内）
    if (price >= 10 && price <= 3000) {
      return price;
    }
  }
  
  return null;
};

/**
 * 年式文字列から年を抽出
 * @param {string|number} yearStr - "2019(R01)" 形式の文字列または数値
 * @returns {number|null} 年または null
 */
export const parseYear = (yearStr) => {
  // 既に数値の場合
  if (typeof yearStr === 'number') {
    return yearStr >= 2010 && yearStr <= 2026 ? yearStr : null;
  }
  
  if (!yearStr) return null;
  
  const match = String(yearStr).match(/(\d{4})/);
  if (match) {
    const year = parseInt(match[1]);
    // 年式範囲チェック（2010-2026年の範囲内）
    return year >= 2010 && year <= 2026 ? year : null;
  }
  
  return null;
};

/**
 * 走行距離文字列から数値を抽出（km単位）
 * @param {string|number} mileageStr - "5.3万km" 形式の文字列または数値
 * @returns {number|null} 走行距離（km）または null
 */
export const parseMileage = (mileageStr) => {
  // 既に数値の場合
  if (typeof mileageStr === 'number') {
    return mileageStr >= 0 ? mileageStr : null;
  }
  
  if (!mileageStr) return null;
  
  const str = String(mileageStr);
  
  if (str.includes('万km')) {
    const match = str.match(/([0-9.]+)万km/);
    if (match) {
      const mileage = parseFloat(match[1]) * 10000;
      return mileage >= 0 ? mileage : null;
    }
  } else if (str.includes('km')) {
    const match = str.match(/([0-9.]+)km/);
    if (match) {
      const mileage = parseFloat(match[1]);
      return mileage >= 0 ? mileage : null;
    }
  }
  
  return null;
};

/**
 * 日付文字列を正規化
 * @param {string} dateStr - 日付文字列
 * @returns {string} YYYY-MM-DD形式の日付文字列
 */
export const parseDate = (dateStr) => {
  if (!dateStr) {
    // フォールバック: 2025年の日付を生成
    const month = Math.floor(Math.random() * 6) + 1; // 1-6月
    const day = Math.floor(Math.random() * 28) + 1;
    return `2025-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  
  // ISODateTime形式の場合、日付部分のみ抽出
  if (dateStr.includes('T')) {
    return dateStr.split('T')[0];
  }
  
  // YYYY-MM-DD形式の場合はそのまま
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // その他の形式の場合は現在日付を使用
  return new Date().toISOString().split('T')[0];
};

/**
 * ミッション情報を4つのカテゴリに分類
 * @param {string} transmission - ミッション情報
 * @returns {string} カテゴリ ('AT', 'CVT', 'MT', 'other')
 */
export const categorizeTransmission = (transmission) => {
  if (!transmission || typeof transmission !== 'string') {
    return 'other';
  }
  
  const trans = transmission.toLowerCase();
  
  // CVT優先判定（ATとCVTが混在する場合）
  if (trans.includes('cvt')) {
    return 'CVT';
  }
  
  // MT判定
  if (trans.includes('mt') || trans.includes('マニュアル') || trans.includes('manual')) {
    return 'MT';
  }
  
  // AT判定
  if (trans.includes('at') || trans.includes('オートマ') || trans.includes('automatic')) {
    return 'AT';
  }
  
  return 'other';
};

/**
 * 排気量文字列から数値を抽出
 * @param {string} displacementStr - "5000CC" 形式の文字列
 * @returns {number|null} 排気量（CC）または null
 */
export const parseDisplacement = (displacementStr) => {
  if (!displacementStr) return null;
  const match = String(displacementStr).match(/(\d+)CC/);
  return match ? parseInt(match[1]) : null;
};

/**
 * グレード名の正規化（簡易版）
 * @param {string} gradeName - 元のグレード名
 * @returns {string} 正規化されたグレード名
 */

/**
 * CSVデータを分析用に変換（修正版）
 * @param {Array} rawData - CSVから読み込んだ生データ
 * @returns {Array} 変換済みデータ
 */
export const processCarData = (rawData) => {
  if (!Array.isArray(rawData)) {
    console.warn('processCarData: rawDataが配列ではありません');
    return [];
  }
  
  return rawData.map((row, index) => {
    try {
      const price = parsePrice(row.支払総額);
      const year = parseYear(row.年式);
      const mileage = parseMileage(row.走行距離);
      const displacement = parseDisplacement(row.排気量);
      
      // 正規グレードが存在しない場合は元グレードを使用
      // JSONファイルから読み込んだグレードをクレンジング
      const normalizedGrade = normalizeGradeName(
        row.正規グレード || row.グレード || ''
      );
      
      // 日付の処理（修正版）
      const date = parseDate(row.取得日時);
      
      // マッチング精度の処理
      let processedMatchingScore = 0.8; // デフォルト値
      if (row.マッチング精度) {
        const score = parseFloat(row.マッチング精度);
        if (!isNaN(score) && score >= 0 && score <= 1) {
          processedMatchingScore = score;
        }
      }
      
      return {
        id: index,
        車種名: row.車種名 || 'Unknown',
        元グレード: row.グレード || '',
        正規グレード: normalizedGrade,
        支払総額: row.支払総額 || '',
        price: price,
        年式: row.年式 || '',
        year: year,
        走行距離: row.走行距離 || '',
        mileage: mileage,
        修復歴: row.修復歴 || 'なし',
        ミッション: row.ミッション || '',
        排気量: row.排気量 || '',
        displacement: displacement,
        マッチング精度: processedMatchingScore,
        取得日時: row.取得日時 || '',
        date: date,
        ソースURL: row.ソースURL || '',
        車両URL: row.車両URL || row.ソースURL || '', // 車両個別URLを追加
        // 追加の分析用フィールド
        pricePerCC: price && displacement ? (price * 10000) / displacement : null,
        ageInYears: year ? (new Date().getFullYear() - year) : null,
        mileagePerYear: year && mileage ? mileage / Math.max(1, new Date().getFullYear() - year) : null
      };
    } catch (error) {
      console.warn(`processCarData: 行${index}の処理でエラー:`, error, row);
      return null;
    }
  }).filter(item => 
    // 必須フィールドが存在し、有効なデータのみ
    item !== null && 
    item.price !== null && 
    item.year !== null && 
    item.mileage !== null &&
    item.price > 0 &&
    item.mileage >= 0
  );
};

/**
 * グレード名の正規化（簡易版）
 * @param {string} gradeName - 元のグレード名
 * @returns {string} 正規化されたグレード名
 */
export const normalizeGradeName = (gradeName) => {
  if (!gradeName) return 'ベース';
  
  // RC Fの特殊パターン
  const rcfPatterns = [
    { pattern: /RC\s+カーボンエクステリアパッケージ/i, normalized: 'カーボンエクステリア' },
    { pattern: /RC\s+パフォーマンスパッケージ/i, normalized: 'パフォーマンス' },
    { pattern: /RC\s+F\s+10th\s+アニバーサリー/i, normalized: '10th アニバーサリー' },
    { pattern: /RC\s+ファイナル\s+エディション/i, normalized: 'ファイナル エディション' },
    { pattern: /RC\s+エモーショナル\s+ツーリング/i, normalized: 'エモーショナル ツーリング' },
    { pattern: /RC\s+5\.0/i, normalized: '5.0' }
  ];
  
  for (const { pattern, normalized } of rcfPatterns) {
    if (pattern.test(gradeName)) {
      return normalized;
    }
  }
  
  // 一般的なパターン
  const cleaned = gradeName
    .replace(/^RC\s+/i, '')
    .replace(/[（）()[\]【】]/g, '')
    .trim();
  
  return cleaned || 'ベース';
};

/**
 * 価格統計の計算（修正版）
 * @param {Array} prices - 価格の配列
 * @returns {Object} 統計情報
 */
export const calculatePriceStats = (prices) => {
  if (!Array.isArray(prices) || prices.length === 0) {
    return { mean: 0, min: 0, max: 0, median: 0, count: 0 };
  }
  
  const validPrices = prices.filter(p => 
    p !== null && 
    p !== undefined && 
    !isNaN(p) && 
    typeof p === 'number' && 
    p > 0
  );
  
  if (validPrices.length === 0) {
    return { mean: 0, min: 0, max: 0, median: 0, count: 0 };
  }
  
  const sorted = [...validPrices].sort((a, b) => a - b);
  const mean = validPrices.reduce((sum, p) => sum + p, 0) / validPrices.length;
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  
  return {
    mean: Math.round(mean * 10) / 10,
    min: Math.min(...validPrices),
    max: Math.max(...validPrices),
    median: Math.round(median * 10) / 10,
    count: validPrices.length
  };
};

/**
 * データをCSV形式でエクスポート（BOM付きUTF-8対応）
 * @param {Array} data - エクスポートするデータ
 * @param {string} filename - ファイル名
 */
export const exportToCSV = (data, filename = 'car_analysis_export.csv') => {
  if (!data || data.length === 0) {
    console.warn('exportToCSV: エクスポートするデータがありません');
    return;
  }
  
  try {
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // null/undefinedの場合は空文字
          if (value === null || value === undefined) {
            return '';
          }
          // カンマやダブルクォートを含む場合はエスケープ
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(',')
      )
    ].join('\n');
    
    // BOM付きUTF-8でエクスポート（Excel対応）
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // URLを解放
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('exportToCSV: エクスポートエラー:', error);
    alert('CSVエクスポートに失敗しました。');
  }
};

/**
 * 既存システムとの互換性を保つデータ形式に変換
 * @param {Array} webData - Web用のデータ
 * @returns {Array} 既存システム用のデータ
 */
export const convertToLegacyFormat = (webData) => {
  if (!Array.isArray(webData)) {
    return [];
  }
  
  return webData.map(item => ({
    車種名: item.車種名 || '',
    モデル: '情報なし', // 既存データに合わせる
    グレード: item.元グレード || '',
    正規グレード: item.正規グレード || '',
    支払総額: item.支払総額 || '',
    年式: item.年式 || '',
    走行距離: item.走行距離 || '',
    修復歴: item.修復歴 || 'なし',
    ミッション: item.ミッション || '',
    排気量: item.排気量 || '',
    マッチング精度: item.マッチング精度 || 0.8,
    取得日時: item.取得日時 || '',
    ソースURL: item.ソースURL || '',
    車両URL: item.車両URL || '' // 車両個別URLを追加
  }));
};

/**
 * データの品質チェック（強化版）
 * @param {Array} data - チェックするデータ
 * @returns {Object} 品質レポート
 */
export const checkDataQuality = (data) => {
  if (!Array.isArray(data) || data.length === 0) {
    return { 
      totalCount: 0, 
      validCount: 0,
      qualityScore: 0,
      issues: ['データが存在しません'] 
    };
  }
  
  const issues = [];
  let validCount = 0;
  let priceIssues = 0;
  let yearIssues = 0;
  let mileageIssues = 0;
  let gradeIssues = 0;
  
  data.forEach((item, index) => {
    let hasIssue = false;
    
    // 価格チェック
    if (!item.price || typeof item.price !== 'number' || item.price <= 0) {
      priceIssues++;
      hasIssue = true;
    }
    
    // 年式チェック  
    if (!item.year || typeof item.year !== 'number' || item.year < 2010 || item.year > 2026) {
      yearIssues++;
      hasIssue = true;
    }
    
    // 走行距離チェック
    if (item.mileage === null || item.mileage === undefined || typeof item.mileage !== 'number' || item.mileage < 0) {
      mileageIssues++;
      hasIssue = true;
    }
    
    // グレードチェック
    if (!item.正規グレード && !item.元グレード) {
      gradeIssues++;
      hasIssue = true;
    }
    
    if (!hasIssue) validCount++;
  });
  
  if (priceIssues > 0) issues.push(`価格データに問題: ${priceIssues}件`);
  if (yearIssues > 0) issues.push(`年式データに問題: ${yearIssues}件`);
  if (mileageIssues > 0) issues.push(`走行距離データに問題: ${mileageIssues}件`);
  if (gradeIssues > 0) issues.push(`グレードデータに問題: ${gradeIssues}件`);
  
  const qualityScore = data.length > 0 ? (validCount / data.length) * 100 : 0;
  
  return {
    totalCount: data.length,
    validCount: validCount,
    qualityScore: Math.round(qualityScore * 10) / 10,
    issues: issues.length > 0 ? issues : ['データ品質に問題はありません'],
    details: {
      priceIssues,
      yearIssues,
      mileageIssues,
      gradeIssues
    }
  };
};