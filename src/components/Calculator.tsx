import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Info, TrendingDown, Calculator as CalcIcon, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Market, PlanItem, CalculationResult } from '../types';

const Calculator: React.FC = () => {
  const [market, setMarket] = useState<Market>('us');
  const [currentQty, setCurrentQty] = useState<number>(0);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [marketPrice, setMarketPrice] = useState<number>(0); // 当前市价
  const [plans, setPlans] = useState<PlanItem[]>([
    { id: '1', price: 0, qty: 0 },
    { id: '2', price: 0, qty: 0 },
  ]);
  const [useFee, setUseFee] = useState<boolean>(true);
  const [targetCost, setTargetCost] = useState<number>(0);
  const [targetTotalQty, setTargetTotalQty] = useState<number>(0);
  const [periods, setPeriods] = useState<number>(12);
  const [keepPosition, setKeepPosition] = useState<boolean>(false);

  const handleReset = () => {
    if (!keepPosition) {
      setCurrentQty(0);
      setCurrentPrice(0);
    }
    setMarketPrice(0);
    setPlans([
      { id: '1', price: 0, qty: 0 },
      { id: '2', price: 0, qty: 0 },
    ]);
    setTargetCost(0);
    setTargetTotalQty(0);
    setPeriods(12);
    setMarket('us');
    setUseFee(true);
  };

  const addPlan = () => {
    setPlans([...plans, { id: Math.random().toString(36).substr(2, 9), price: 0, qty: 0 }]);
  };

  const removePlan = (id: string) => {
    setPlans(plans.filter(p => p.id !== id));
  };

  const updatePlan = (id: string, field: 'price' | 'qty', value: number) => {
    setPlans(plans.map(p => {
      if (p.id === id) {
        return { ...p, [field]: value };
      }
      return p;
    }));
  };

  const results = useMemo((): CalculationResult => {
    let totalCost = currentQty * currentPrice;
    let totalQty = currentQty;

    plans.forEach(plan => {
      let qty = plan.qty;
      if (market === 'a' && qty > 0) {
        qty = Math.round(qty / 100) * 100;
      }

      if (plan.price > 0 && qty > 0) {
        let buyCost = plan.price * qty;

        if (useFee) {
          if (market === 'a') {
            const buyFee = Math.max(buyCost * 0.00025, 5);
            buyCost += buyFee;
          } else if (market === 'hk') {
            const buyFee = buyCost * (0.0003 + 0.00027 + 0.00005);
            buyCost += buyFee;
          }
        }

        totalCost += buyCost;
        totalQty += qty;
      }
    });

    const finalAvgCost = totalQty > 0 ? totalCost / totalQty : 0;
    const costReduce = currentPrice > 0 ? currentPrice - finalAvgCost : 0;
    const totalInvest = totalCost - (currentQty * currentPrice);
    const diffPercent = currentPrice > 0 ? ((finalAvgCost - currentPrice) / currentPrice) * 100 : 0;

    // Reverse calculation logic:
    // We want to reach TargetCost by buying MORE at MarketPrice
    // (CurrentTotalCost + NeededQty * MarketPrice) / (CurrentTotalQty + NeededQty) = TargetCost
    // Solving for NeededQty:
    // NeededQty = (CurrentTotalCost - TargetCost * CurrentTotalQty) / (TargetCost - MarketPrice)
    let neededQty = 0;
    let neededMoney = 0;
    let isUnreachable = false;
    
    if (targetCost > 0 && totalQty > 0 && finalAvgCost > 0 && marketPrice > 0) {
      // Logic check: Target cost must be between current average and buy price
      const canAverageDown = targetCost < finalAvgCost && targetCost > marketPrice;
      const canAverageUp = targetCost > finalAvgCost && targetCost < marketPrice;

      if (canAverageDown || canAverageUp) {
        // Basic formula
        neededQty = (totalCost - targetCost * totalQty) / (targetCost - marketPrice);
        
        // If fees are enabled, the target cost is harder to hit exactly.
        // We adjust the formula slightly to account for the fee rate.
        if (useFee) {
          let feeRate = 0;
          if (market === 'a') feeRate = 0.00025;
          else if (market === 'hk') feeRate = 0.0003 + 0.00027 + 0.00005;
          
          // Adjusted formula: (totalCost + neededQty * marketPrice * (1 + feeRate)) / (totalQty + neededQty) = targetCost
          // neededQty = (totalCost - targetCost * totalQty) / (targetCost - marketPrice * (1 + feeRate))
          const adjustedMarketPrice = marketPrice * (1 + feeRate);
          
          // Re-check reachability with fees
          const canReachWithFees = (targetCost < finalAvgCost && targetCost > adjustedMarketPrice) || 
                                   (targetCost > finalAvgCost && targetCost < adjustedMarketPrice);
          
          if (canReachWithFees) {
            neededQty = (totalCost - targetCost * totalQty) / (targetCost - adjustedMarketPrice);
          }
        }

        // A-share rounding
        if (market === 'a') {
          neededQty = Math.ceil(neededQty / 100) * 100;
        }
        
        neededMoney = neededQty * marketPrice;
        
        // Add fees to the total money needed
        if (useFee) {
          if (market === 'a') {
            neededMoney += Math.max(neededMoney * 0.00025, 5);
          } else if (market === 'hk') {
            neededMoney += neededMoney * (0.0003 + 0.00027 + 0.00005);
          }
        }
      } else {
        isUnreachable = true;
      }
    }

    // Target Total Qty Planning
    const qtyGap = Math.max(0, targetTotalQty - totalQty);
    let totalFundsNeeded = qtyGap * marketPrice;
    if (useFee && qtyGap > 0 && marketPrice > 0) {
      if (market === 'a') {
        totalFundsNeeded += Math.max(totalFundsNeeded * 0.00025, 5);
      } else if (market === 'hk') {
        totalFundsNeeded += totalFundsNeeded * (0.0003 + 0.00027 + 0.00005);
      }
    }
    const periodicInvestment = periods > 0 ? totalFundsNeeded / periods : 0;

    return {
      beforeCost: currentPrice,
      costReduce,
      totalInvest,
      finalQty: totalQty,
      finalCost: finalAvgCost,
      diffPercent,
      neededQty: Math.max(0, Math.round(neededQty)),
      neededMoney: Math.max(0, neededMoney),
      isUnreachable,
      qtyGap,
      totalFundsNeeded,
      periodicInvestment
    };
  }, [currentQty, currentPrice, marketPrice, plans, market, useFee, targetCost, targetTotalQty, periods]);

  const marketInfo = {
    a: {
      tip: '提示：A股买入需为100股的整数倍。',
      fee: '已开启 (A股默认: 买入0.025%, 卖出0.125%)'
    },
    hk: {
      tip: '提示：港股每手股数由公司决定，请注意整手交易。',
      fee: '已开启 (港股默认: 双边0.03% + 印花税等杂费)'
    },
    us: {
      tip: '提示：美股支持整股或碎股交易。',
      fee: '已开启 (美股通常免佣金，或收极低平台费)'
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4 flex justify-center items-start font-sans">
      <motion.div 
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white w-full max-w-lg rounded-2xl shadow-xl p-6 md:p-8"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center justify-center gap-2">
              <CalcIcon className="text-emerald-500" />
              定投成本计算器
            </h1>
            <p className="text-gray-500 text-sm mt-1">智能摊低成本 · 投资策略模拟</p>
          </div>
        </div>

        {/* Market Tabs */}
        <div className="flex bg-gray-50 border border-gray-200 rounded-xl overflow-hidden mb-6">
          {(['us', 'a', 'hk'] as Market[]).map((m) => (
            <button
              key={m}
              onClick={() => setMarket(m)}
              className={`flex-1 py-3 text-sm font-semibold transition-all ${
                market === m 
                  ? 'bg-emerald-500 text-white shadow-inner' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {m === 'a' ? 'A股' : m === 'hk' ? '港股' : '美股'}
            </button>
          ))}
        </div>

        {/* Current Position */}
        <div className="space-y-4 mb-8">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">当前持仓</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-gray-500 font-medium">持仓数量 (股)</label>
              <input
                type="number"
                value={currentQty || ''}
                placeholder="0"
                onChange={(e) => setCurrentQty(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <div className="flex items-center gap-1.5 mt-1.5">
                <input
                  type="checkbox"
                  id="keepPosition"
                  checked={keepPosition}
                  onChange={(e) => setKeepPosition(e.target.checked)}
                  className="w-3.5 h-3.5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="keepPosition" className="text-[10px] text-gray-400 cursor-pointer select-none">重置时保留持仓数据</label>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-500 font-medium">成本价格 (CNY)</label>
              <input
                type="number"
                value={currentPrice || ''}
                placeholder="0.00"
                onChange={(e) => setCurrentPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Investment Plans */}
        <motion.div layout className="space-y-4 mb-8">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">定投计划 (分批买入)</h2>
          <div className="space-y-3 min-h-[140px] relative">
            <AnimatePresence mode="popLayout" initial={false}>
              {plans.map((plan) => (
                <motion.div
                  key={plan.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100"
                >
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="价格"
                      value={plan.price || ''}
                      onChange={(e) => updatePlan(plan.id, 'price', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    <input
                      type="number"
                      placeholder="数量"
                      value={plan.qty || ''}
                      onChange={(e) => updatePlan(plan.id, 'qty', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <button 
                    onClick={() => removePlan(plan.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <button
            onClick={addPlan}
            className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 text-sm font-medium hover:bg-gray-50 hover:border-emerald-300 hover:text-emerald-600 transition-all flex items-center justify-center gap-2"
          >
            <Plus size={18} /> 添加批次
          </button>
          <button 
            onClick={handleReset}
            className="w-full py-2 mt-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all flex items-center justify-center gap-1 text-xs font-medium"
          >
            <RotateCcw size={16} />
            重置
          </button>
        </motion.div>

        {/* Fee Toggle */}
        <div className="flex items-center gap-4 py-4 mb-8 border-b border-gray-100">
          <div className="flex items-center gap-3 flex-1">
            <span className="text-sm text-gray-600">交易费率</span>
            <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition-colors focus-within:ring-2 focus-within:ring-emerald-500 focus-within:ring-offset-2">
              <input
                type="checkbox"
                className="sr-only"
                checked={useFee}
                onChange={(e) => setUseFee(e.target.checked)}
              />
              <span
                className={`${
                  useFee ? 'translate-x-6 bg-emerald-600' : 'translate-x-1 bg-white'
                } inline-block h-4 w-4 transform rounded-full transition-transform`}
              />
            </div>
            <span className="text-xs text-gray-400">{marketInfo[market].fee}</span>
          </div>
        </div>

        {/* Results Section - Updated to match image layout */}
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-y-3 gap-x-8">
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-1">补仓前成本</p>
              <p className="text-xl font-bold text-gray-800">{results.beforeCost.toFixed(3)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-1">成本降低</p>
              <p className="text-xl font-bold text-emerald-500">
                {results.costReduce > 0 ? results.costReduce.toFixed(3) : '0.000'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-1">累计投入</p>
              <p className="text-xl font-bold text-gray-800">¥{results.totalInvest.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-1">最终持仓</p>
              <p className="text-xl font-bold text-gray-800">{results.finalQty.toLocaleString()}</p>
            </div>
          </div>

          <div className="text-center py-2">
            <p className="text-sm text-gray-400 mb-1">最终平均成本</p>
            <p className="text-4xl font-bold text-emerald-500 tracking-tight">{results.finalCost.toFixed(3)}</p>
          </div>

          <div className="text-center space-y-2">
            <p className="text-sm text-gray-500">
              距离回本还差 <span className={results.diffPercent > 0 ? 'text-red-500' : 'text-emerald-500'}>
                {results.diffPercent.toFixed(2)}%
              </span>
            </p>
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${currentPrice > 0 ? Math.min(100, Math.max(0, (results.costReduce / currentPrice) * 100)) : 0}%` }}
                className="h-full bg-emerald-500 rounded-full"
              />
            </div>
          </div>

          {/* Target Cost Card - Self Contained Reverse Calculator */}
          <div className="bg-gray-50 p-6 rounded-2xl space-y-5 border border-gray-100">
            <div className="flex items-center justify-center gap-2 text-gray-700">
              <TrendingDown size={18} className="text-red-500" />
              <h3 className="font-bold">🎯 目标成本 (反向计算)</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-gray-500 font-medium text-center block">目标成本</label>
                <input
                  type="number"
                  value={targetCost || ''}
                  placeholder="0.00"
                  onChange={(e) => setTargetCost(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-center text-lg font-semibold"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-gray-500 font-medium text-center block">拟买入单价</label>
                <input
                  type="number"
                  value={marketPrice || ''}
                  placeholder="0.00"
                  onChange={(e) => setMarketPrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-center text-lg font-semibold"
                />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm min-h-[84px] flex flex-col justify-center">
              {results.isUnreachable ? (
                <div className="text-center py-2">
                  <p className="text-sm text-red-500 font-medium">无法达到该目标成本</p>
                  <p className="text-[10px] text-gray-400 mt-1">目标成本必须介于当前成本与买入单价之间</p>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-500">建议买入数量</span>
                    <span className="text-lg font-bold text-gray-800">
                      {results.neededQty > 0 ? results.neededQty.toLocaleString() : '0'} 
                      <span className="text-xs font-normal text-gray-400 ml-1">股</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">预估所需资金</span>
                    <span className="text-lg font-bold text-emerald-600">
                      ¥{results.neededMoney.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </>
              )}
            </div>
            
          <p className="text-[10px] text-gray-400 text-center leading-tight">
              计算逻辑：基于您当前的持仓（含定投计划）作为基准，计算在拟买入单价下达到目标成本所需的额外股数。
            </p>
          </div>

          {/* Target Quantity Planning Card */}
          <div className="bg-emerald-50/50 p-6 rounded-2xl space-y-5 border border-emerald-100">
            <div className="flex items-center justify-center gap-2 text-emerald-800">
              <TrendingDown size={18} className="text-emerald-500 rotate-180" />
              <h3 className="font-bold">📈 持仓规划 (目标持仓)</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-gray-500 font-medium text-center block">最终目标持仓</label>
                <input
                  type="number"
                  value={targetTotalQty || ''}
                  placeholder="0"
                  onChange={(e) => setTargetTotalQty(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-white border border-emerald-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-center text-lg font-semibold"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-gray-500 font-medium text-center block">拟定投期数</label>
                <input
                  type="number"
                  value={periods || ''}
                  placeholder="12"
                  onChange={(e) => setPeriods(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-white border border-emerald-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-center text-lg font-semibold"
                />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">尚需买入数量</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={results.qtyGap || ''}
                    placeholder="0"
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setTargetTotalQty(results.finalQty + val);
                    }}
                    className="w-24 px-2 py-1 bg-transparent border-b border-dashed border-gray-200 focus:border-emerald-500 outline-none text-right text-lg font-bold text-gray-800 transition-colors"
                  />
                  <span className="text-xs font-normal text-gray-400">股</span>
                </div>
              </div>
              <div className="flex justify-between items-center border-t border-gray-50 pt-2">
                <span className="text-sm text-gray-500">预估总投入</span>
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 text-sm">¥</span>
                  <input
                    type="number"
                    step="0.01"
                    value={results.totalFundsNeeded ? results.totalFundsNeeded.toFixed(2) : ''}
                    placeholder="0.00"
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      if (marketPrice > 0) {
                        // Reverse calculation (approximate)
                        const gap = val / marketPrice;
                        setTargetTotalQty(Math.round(results.finalQty + gap));
                      }
                    }}
                    className="w-32 px-2 py-1 bg-transparent border-b border-dashed border-gray-200 focus:border-emerald-500 outline-none text-right text-lg font-bold text-gray-800 transition-colors"
                  />
                </div>
              </div>
              <div className="flex justify-between items-center bg-emerald-50 -mx-4 -mb-4 p-4 rounded-b-xl">
                <span className="text-sm font-medium text-emerald-800">每期预估投入</span>
                <div className="text-right">
                  <span className="text-xl font-bold text-emerald-600">
                    ¥{results.periodicInvestment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <p className="text-[10px] text-emerald-500 font-normal">基于拟买入单价计算</p>
                </div>
              </div>
            </div>
            
            <p className="text-[10px] text-gray-400 text-center leading-tight">
              计算逻辑：根据目标持仓与当前持仓（含定投计划）的差额，结合“拟买入单价”计算所需总资金及每期平均投入。
            </p>
          </div>

          <p className="text-center text-xs text-gray-400">{marketInfo[market].tip}</p>
        </div>
      </motion.div>
    </div>
  );
};

export default Calculator;
