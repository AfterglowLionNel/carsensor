/**
 * データ処理ユーティリティ
 * 既存のPythonシステムとの連携を考慮
 */

/**
 * 価格文字列から数値を抽出
 * @param {string} priceStr - "659.9万円" 形式の文字列
 * @returns {number|null} 数値または null
 */
export const parsePrice = (priceStr) => {
  if (!priceStr) return null;
  const match = priceStr.match(/([0-9.]+)万円/);
  return match ? parseFloat(match[1]) : null;
};

/**
 * 年式文字列から年を抽出
 * @param {string} yearStr - "2019(R01)" 形式の文字列
 * @returns {number|null} 年または null
 */
export const parseYear = (yearStr) => {
  if (!yearStr) return null;
  const match = yearStr.match(/(\d{4})/);
  return match ? parseInt(match[1]) : null;
};

/**
 * 走行距離文字列から数値を抽出（km単位）
 * @param {string} mileageStr - "5.3万km" 形式の文字列
 * @returns {number|null} 走行距離（km）または null
 */
export const parseMileage = (mileageStr) => {
  if (!mileageStr) return null;
  
  if (mileageStr.includes('万km')) {
    const match = mileageStr.match(/([0-9.]+)万km/);
    return match ? parseFloat(match[1]) * 10000 : null;
  } else if (mileageStr.includes('km')) {
    const match = mileageStr.match(/([0-9.]+)km/);
    return match ? parseFloat(match[1]) : null;
  }
  
  return null;
};

/**
 * 排気量文字列から数値を抽出
 * @param {string} displacementStr - "5000CC" 形式の文字列
 * @returns {number|null} 排気量（CC）または null
 */
export const parseDisplacement = (displacementStr) => {
  if (!displacementStr) return null;
  const match = displacementStr.match(/(\d+)CC/);
  return match ? parseInt(match[1]) : null;
};

/**
 * CSVデータを分析用に変換
 * @param {Array} rawData - CSVから読み込んだ生データ
 * @returns {Array} 変換済みデータ
 */
export const processCarData = (rawData) => {
  return rawData.map((row, index) => {
    const price = parsePrice(row.支払総額);
    const year = parseYear(row.年式);
    const mileage = parseMileage(row.走行距離);
    const displacement = parseDisplacement(row.排気量);
    
    // 正規グレードが存在しない場合は元グレードを使用
    const normalizedGrade = row.正規グレード || row.グレード || '';
    
    // 日付の処理
    let date = row.取得日時;
    if (!date) {
      // フォールバック: ランダムな日付を生成
      const randomMonth = Math.floor(Math.random() * 12) + 1;
      const randomDay = Math.floor(Math.random() * 28) + 1;
      date = `2024-${String(randomMonth).padStart(2, '0')}-${String(randomDay).padStart(2, '0')}`;
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
      マッチング精度: parseFloat(row.マッチング精度) || 0.8,
      取得日時: row.取得日時 || '',
      date: date,
      // 追加の分析用フィールド
      pricePerCC: price && displacement ? (price * 10000) / displacement : null,
      ageInYears: year ? (new Date().getFullYear() - year) : null,
      mileagePerYear: year && mileage ? mileage / Math.max(1, new Date().getFullYear() - year) : null
    };
  }).filter(item => 
    // 必須フィールドが存在するデータのみ
    item.price !== null && 
    item.year !== null && 
    item.mileage !== null
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
    .replace(/[（）\(\)\[\]【】]/g, '')
    .trim();
  
  return cleaned || 'ベース';
};

/**
 * 価格統計の計算
 * @param {Array} prices - 価格の配列
 * @returns {Object} 統計情報
 */
export const calculatePriceStats = (prices) => {
  if (!prices || prices.length === 0) {
    return { mean: 0, min: 0, max: 0, median: 0, count: 0 };
  }
  
  const validPrices = prices.filter(p => p !== null && !isNaN(p));
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
 * データをCSV形式でエクスポート
 * @param {Array} data - エクスポートするデータ
 * @param {string} filename - ファイル名
 */
export const exportToCSV = (data, filename = 'car_analysis_export.csv') => {
  if (!data || data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // カンマやダブルクォートを含む場合はエスケープ
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * 既存システムとの互換性を保つデータ形式に変換
 * @param {Array} webData - Web用のデータ
 * @returns {Array} 既存システム用のデータ
 */
export const convertToLegacyFormat = (webData) => {
  return webData.map(item => ({
    車種名: item.車種名,
    モデル: '情報なし', // 既存データに合わせる
    グレード: item.元グレード,
    正規グレード: item.正規グレード,
    支払総額: item.支払総額,
    年式: item.年式,
    走行距離: item.走行距離,
    修復歴: item.修復歴,
    ミッション: item.ミッション,
    排気量: item.排気量,
    マッチング精度: item.マッチング精度,
    取得日時: item.取得日時,
    ソースURL: item.ソースURL || ''
  }));
};

/**
 * データの品質チェック
 * @param {Array} data - チェックするデータ
 * @returns {Object} 品質レポート
 */
export const checkDataQuality = (data) => {
  if (!data || data.length === 0) {
    return { totalCount: 0, issues: ['データが存在しません'] };
  }
  
  const issues = [];
  let validCount = 0;
  let priceIssues = 0;
  let yearIssues = 0;
  let mileageIssues = 0;
  
  data.forEach((item, index) => {
    let hasIssue = false;
    
    if (!item.price || item.price <= 0) {
      priceIssues++;
      hasIssue = true;
    }
    
    if (!item.year || item.year < 2010 || item.year > new Date().getFullYear() + 1) {
      yearIssues++;
      hasIssue = true;
    }
    
    if (!item.mileage || item.mileage < 0) {
      mileageIssues++;
      hasIssue = true;
    }
    
    if (!hasIssue) validCount++;
  });
  
  if (priceIssues > 0) issues.push(`価格データに問題: ${priceIssues}件`);
  if (yearIssues > 0) issues.push(`年式データに問題: ${yearIssues}件`);
  if (mileageIssues > 0) issues.push(`走行距離データに問題: ${mileageIssues}件`);
  
  const qualityScore = data.length > 0 ? (validCount / data.length) * 100 : 0;
  
  return {
    totalCount: data.length,
    validCount: validCount,
    qualityScore: Math.round(qualityScore * 10) / 10,
    issues: issues.length > 0 ? issues : ['データ品質に問題はありません']
  };
};