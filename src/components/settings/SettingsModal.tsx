'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, Trophy, Palette, Users, Shield, Plus, Pencil, Trash2, Check, RefreshCw, Eye, EyeOff, Wifi, ChevronLeft, ChevronRight } from 'lucide-react';
import { PointConfig, DEFAULT_POINT_CONFIG, AdvancedPointSettings, DEFAULT_ADVANCED_POINT_SETTINGS, ThemeId, THEME_OPTIONS, UserProfile } from '@/lib/ai/types';
import { getAllUsers, createUser, updateUserName, deleteUser, getActiveUserId, setActiveUserId, ensureDefaultUser } from '@/lib/storage/user-store';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
  // Quiz tab
  quizTypes: string[];
  setQuizTypes: (types: string[]) => void;
  retryMultipleChoice: boolean;
  setRetryMultipleChoice: (v: boolean) => void;
  quizFontSize: string;
  setQuizFontSize: (v: string) => void;
  showContextTiming: 'always' | 'after_quiz';
  setShowContextTiming: (v: 'always' | 'after_quiz') => void;
  // Point tab
  passThreshold: number;
  setPassThreshold: (v: number) => void;
  pointConfig: PointConfig;
  setPointConfig: (v: PointConfig) => void;
  advancedPoints: AdvancedPointSettings;
  setAdvancedPoints: (v: AdvancedPointSettings) => void;
  // Theme tab
  currentTheme: ThemeId;
  setCurrentTheme: (v: ThemeId) => void;
  // Admin tab
  apiKey: string;
  setApiKey: (v: string) => void;
  aiProvider: string;
  setAiProvider: (v: string) => void;
  selectedModel: string;
  setSelectedModel: (v: string) => void;
  availableModels: string[];
  onFetchModels: () => void;
  onTestConnection: () => void;
  parentPin: string;
  setParentPin: (v: string) => void;
  parentLockEnabled: boolean;
  setParentLockEnabled: (v: boolean) => void;
  onResetPoints: () => void;
  onResetHistory: () => void;
  onResetSettings: () => void;
  onResetAll: () => void;
  // User tab
  activeUserId: string;
  onSwitchUser: (id: string) => void;
}

export type SettingsTab = 'quiz' | 'points' | 'theme' | 'users' | 'admin';

export default function SettingsModal(props: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(props.initialTab || 'quiz');
  const [showPin, setShowPin] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const tabsRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (tabsRef.current) {
      setCanScrollLeft(tabsRef.current.scrollLeft > 0);
      setCanScrollRight(
        tabsRef.current.scrollLeft < tabsRef.current.scrollWidth - tabsRef.current.clientWidth - 1
      );
    }
  };

  useEffect(() => {
    if (props.isOpen) {
      if (props.initialTab) {
        setActiveTab(props.initialTab);
      }
      setTimeout(checkScroll, 100);
    }
  }, [props.isOpen, props.initialTab]);

  useEffect(() => {
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, []);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (props.isOpen) {
      setUsers(getAllUsers());
      setAdminUnlocked(!props.parentLockEnabled);
    }
  }, [props.isOpen, props.parentLockEnabled]);

  if (!props.isOpen) return null;

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'quiz', label: '퀴즈', icon: <BookOpen size={16} /> },
    { id: 'points', label: '포인트', icon: <Trophy size={16} /> },
    { id: 'theme', label: '테마', icon: <Palette size={16} /> },
    { id: 'users', label: '사용자', icon: <Users size={16} /> },
    { id: 'admin', label: '관리자', icon: <Shield size={16} /> },
  ];

  const handlePinCheck = () => {
    if (pinInput === props.parentPin) {
      setAdminUnlocked(true);
      setPinInput('');
    } else {
      alert('비밀번호가 틀렸습니다.');
      setPinInput('');
    }
  };

  const handleAddUser = () => {
    const u = createUser();
    setUsers(getAllUsers());
    props.onSwitchUser(u.id);
  };

  const handleDeleteUser = (id: string) => {
    if (users.length <= 1) {
      alert('최소 1명의 사용자가 필요합니다.');
      return;
    }
    if (confirm('이 사용자와 관련된 모든 데이터가 삭제됩니다. 계속하시겠습니까?')) {
      deleteUser(id);
      setUsers(getAllUsers());
      const remaining = getAllUsers();
      if (remaining.length > 0) props.onSwitchUser(remaining[0].id);
    }
  };

  const handleSaveUserName = (userId: string) => {
    if (editName.trim()) {
      updateUserName(userId, editName.trim());
      setUsers(getAllUsers());
    }
    setEditingUser(null);
    setEditName('');
  };

  const Toggle = ({ value, onChange, label, locked }: { value: boolean; onChange: (v: boolean) => void; label: string; locked?: boolean }) => (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-slate-300">{label}</span>
      <motion.button
        onTap={() => !locked && onChange(!value)}
        disabled={locked}
        className={`relative w-12 h-6 rounded-full transition-colors ${value ? 'bg-sky-500' : 'bg-slate-700'} ${locked ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <motion.div
          className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow"
          animate={{ left: value ? '26px' : '2px' }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </motion.button>
    </div>
  );

  const isLocked = props.parentLockEnabled && !adminUnlocked;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg h-[85vh] md:h-[650px] bg-slate-900 rounded-[28px] border border-slate-700/50 shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-xl font-black text-white">⚙️ 설정</h2>
          <button onClick={props.onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="relative border-b border-slate-800">
          {canScrollLeft && (
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-slate-900 to-transparent z-10 flex items-center justify-start">
              <button onClick={() => tabsRef.current?.scrollBy({ left: -100, behavior: 'smooth' })} className="p-1 text-slate-400 hover:text-white">
                <ChevronLeft size={16} />
              </button>
            </div>
          )}
          <div 
            ref={tabsRef}
            onScroll={checkScroll}
            className="flex overflow-x-auto px-2 custom-scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-bold whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-sky-500 text-sky-400'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
          {canScrollRight && (
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-900 to-transparent z-10 flex items-center justify-end">
              <button onClick={() => tabsRef.current?.scrollBy({ left: 100, behavior: 'smooth' })} className="p-1 text-slate-400 hover:text-white">
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {/* ═══════ Quiz Tab ═══════ */}
          {activeTab === 'quiz' && (
            <div className="space-y-4">
              <div className="space-y-2 border-b border-slate-800 pb-4">
                <label className="text-sm text-slate-300 font-bold">출제 가능한 문제 유형 (다중 선택 가능)</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'MULTIPLE_CHOICE', label: '객관식 (선다형)', emoji: '📋' },
                    { id: 'SHORT_ANSWER', label: '단답형 (짧은 답)', emoji: '✏️' },
                    { id: 'ESSAY', label: '서술형 (긴 답)', emoji: '📝' },
                    { id: 'CSAT', label: '수능형 (논리 추론)', emoji: '🎓' },
                    { id: 'TRUE_FALSE', label: 'O/X (참/거짓)', emoji: '⭕' },
                  ].map(type => (
                    <motion.button
                      key={type.id}
                      onTap={() => {
                        if (isLocked) return;
                        if (props.quizTypes.includes(type.id)) {
                          if (props.quizTypes.length > 1) props.setQuizTypes(props.quizTypes.filter(t => t !== type.id));
                        } else {
                          props.setQuizTypes([...props.quizTypes, type.id]);
                        }
                      }}
                      className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all flex items-center justify-between ${
                        props.quizTypes.includes(type.id) 
                          ? 'bg-sky-500/20 border-sky-500/50 text-sky-300' 
                          : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                      } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span>{type.emoji} {type.label}</span>
                      {props.quizTypes.includes(type.id) && <Check size={14} className="text-sky-400" />}
                    </motion.button>
                  ))}
                </div>
              </div>

              <Toggle value={props.retryMultipleChoice} onChange={props.setRetryMultipleChoice} label="객관식 2번 기회" locked={isLocked} />
              
              <div className="space-y-2">
                <label className="text-sm text-slate-300 font-bold">글자 크기</label>
                <div className="flex gap-2">
                  {['small', 'medium', 'large'].map(s => (
                    <button key={s} onClick={() => !isLocked && props.setQuizFontSize(s)}
                      className={`flex-1 py-2 rounded-xl border text-sm transition-all ${props.quizFontSize === s ? 'bg-sky-500/20 border-sky-500/50 text-sky-300' : 'bg-slate-800/50 border-slate-700 text-slate-400'} ${isLocked ? 'opacity-50' : ''}`}>
                      {s === 'small' ? '작게' : s === 'medium' ? '보통' : '크게'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-slate-300 font-bold">원문 근거 노출 시점</label>
                <div className="flex gap-2">
                  <button onClick={() => !isLocked && props.setShowContextTiming('always')}
                    className={`flex-1 py-2 rounded-xl border text-sm ${props.showContextTiming === 'always' ? 'bg-sky-500/20 border-sky-500/50 text-sky-300' : 'bg-slate-800/50 border-slate-700 text-slate-400'}`}>
                    항상
                  </button>
                  <button onClick={() => !isLocked && props.setShowContextTiming('after_quiz')}
                    className={`flex-1 py-2 rounded-xl border text-sm ${props.showContextTiming === 'after_quiz' ? 'bg-sky-500/20 border-sky-500/50 text-sky-300' : 'bg-slate-800/50 border-slate-700 text-slate-400'}`}>
                    퀴즈 완료 후
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-slate-300 font-bold">객관식 선다 수</label>
                <div className="flex gap-2">
                  {([4, 5] as const).map(n => (
                    <button key={n} onClick={() => !isLocked && props.setAdvancedPoints({...props.advancedPoints, multipleChoiceCount: n})}
                      className={`flex-1 py-2 rounded-xl border text-sm ${props.advancedPoints.multipleChoiceCount === n ? 'bg-sky-500/20 border-sky-500/50 text-sky-300' : 'bg-slate-800/50 border-slate-700 text-slate-400'}`}>
                      {n}지선다
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-slate-300 font-bold">정답 확인 시점</label>
                <div className="flex gap-2">
                  <button onClick={() => !isLocked && props.setAdvancedPoints({...props.advancedPoints, answerRevealTiming: 'immediate'})}
                    className={`flex-1 py-2 rounded-xl border text-sm ${props.advancedPoints.answerRevealTiming === 'immediate' ? 'bg-sky-500/20 border-sky-500/50 text-sky-300' : 'bg-slate-800/50 border-slate-700 text-slate-400'}`}>
                    매 문제마다
                  </button>
                  <button onClick={() => !isLocked && props.setAdvancedPoints({...props.advancedPoints, answerRevealTiming: 'after_all'})}
                    className={`flex-1 py-2 rounded-xl border text-sm ${props.advancedPoints.answerRevealTiming === 'after_all' ? 'bg-sky-500/20 border-sky-500/50 text-sky-300' : 'bg-slate-800/50 border-slate-700 text-slate-400'}`}>
                    다 풀고 한번에
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═══════ Points Tab ═══════ */}
          {activeTab === 'points' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm text-slate-300 font-bold">통과 기준</label>
                  <span className="text-sky-400 font-bold text-sm">{props.passThreshold}%</span>
                </div>
                <input type="range" min="10" max="100" step="10" value={props.passThreshold}
                  onChange={e => !isLocked && props.setPassThreshold(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg accent-sky-500" disabled={isLocked} />
              </div>

              <div className="space-y-3">
                <label className="text-sm text-slate-300 font-bold">유형별 기본 포인트</label>
                {[
                  { key: 'MULTIPLE_CHOICE' as const, label: '객관식' },
                  { key: 'SHORT_ANSWER' as const, label: '단답형' },
                  { key: 'ESSAY' as const, label: '서술형' },
                  { key: 'CSAT' as const, label: '수능형' },
                  { key: 'TRUE_FALSE' as const, label: 'O/X' },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">{item.label}</span>
                    <input type="number" min="0" max="100"
                      value={props.pointConfig[item.key]}
                      onChange={e => !isLocked && props.setPointConfig({ ...props.pointConfig, [item.key]: parseInt(e.target.value) || 0 })}
                      className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-center text-sm focus:ring-2 focus:ring-sky-500"
                      disabled={isLocked} />
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-800 pt-4 space-y-3">
                <label className="text-sm text-slate-300 font-bold">난이도 가중치</label>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">어려움 보너스</span>
                  <div className="flex items-center gap-2">
                    <input type="number" min="100" max="200" step="5"
                      value={Math.round(props.advancedPoints.difficultyWeightHard * 100)}
                      onChange={e => props.setAdvancedPoints({...props.advancedPoints, difficultyWeightHard: parseInt(e.target.value) / 100})}
                      className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-center text-sm" disabled={isLocked} />
                    <span className="text-xs text-slate-500">%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">쉬움 감소</span>
                  <div className="flex items-center gap-2">
                    <input type="number" min="10" max="100" step="5"
                      value={Math.round(props.advancedPoints.difficultyWeightEasy * 100)}
                      onChange={e => props.setAdvancedPoints({...props.advancedPoints, difficultyWeightEasy: parseInt(e.target.value) / 100})}
                      className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-center text-sm" disabled={isLocked} />
                    <span className="text-xs text-slate-500">%</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-4 space-y-3">
                <Toggle value={props.advancedPoints.allowPartialPoints}
                  onChange={v => props.setAdvancedPoints({...props.advancedPoints, allowPartialPoints: v})}
                  label="미통과 시 부분 포인트" locked={isLocked} />
                {props.advancedPoints.allowPartialPoints && (
                  <div className="flex items-center justify-between pl-4">
                    <span className="text-xs text-slate-500">비율</span>
                    <div className="flex items-center gap-2">
                      <input type="number" min="10" max="100" step="10"
                        value={Math.round(props.advancedPoints.partialPointsRatio * 100)}
                        onChange={e => props.setAdvancedPoints({...props.advancedPoints, partialPointsRatio: parseInt(e.target.value) / 100})}
                        className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-center text-sm" disabled={isLocked} />
                      <span className="text-xs text-slate-500">%</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-800 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300 font-bold">최소 문제 수 (꼼수 방지)</span>
                  <input type="number" min="1" max="20"
                    value={props.advancedPoints.minQuestionsForPoints}
                    onChange={e => props.setAdvancedPoints({...props.advancedPoints, minQuestionsForPoints: parseInt(e.target.value) || 1})}
                    className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-center text-sm" disabled={isLocked} />
                </div>
                <p className="text-[11px] text-slate-600">이 수 미만으로 문제를 만들면 포인트가 지급되지 않습니다</p>
              </div>

              <div className="border-t border-slate-800 pt-4 space-y-3">
                <Toggle value={props.advancedPoints.bonusEnabled}
                  onChange={v => props.setAdvancedPoints({...props.advancedPoints, bonusEnabled: v})}
                  label="🎰 보너스 포인트 (전부 정답 시)" locked={isLocked} />
                {props.advancedPoints.bonusEnabled && (
                  <div className="space-y-3 pl-4">
                    <div className="space-y-2">
                      <label className="text-xs text-slate-500 font-bold">방식</label>
                      <div className="flex gap-2">
                        <button onClick={() => props.setAdvancedPoints({...props.advancedPoints, bonusMode: 'roulette'})}
                          className={`flex-1 py-2 rounded-xl border text-sm ${props.advancedPoints.bonusMode === 'roulette' ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'bg-slate-800/50 border-slate-700 text-slate-400'}`}>
                          🎰 룰렛
                        </button>
                        <button onClick={() => props.setAdvancedPoints({...props.advancedPoints, bonusMode: 'card'})}
                          className={`flex-1 py-2 rounded-xl border text-sm ${props.advancedPoints.bonusMode === 'card' ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'bg-slate-800/50 border-slate-700 text-slate-400'}`}>
                          🃏 카드
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">등장 확률</span>
                      <div className="flex items-center gap-2">
                        <input type="number" min="1" max="100"
                          value={props.advancedPoints.bonusProbability}
                          onChange={e => props.setAdvancedPoints({...props.advancedPoints, bonusProbability: parseInt(e.target.value) || 1})}
                          className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-center text-sm" disabled={isLocked} />
                        <span className="text-xs text-slate-500">%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">포인트 범위</span>
                      <div className="flex items-center gap-1">
                        <input type="number" min="1" max="100"
                          value={props.advancedPoints.bonusMinPoints}
                          onChange={e => props.setAdvancedPoints({...props.advancedPoints, bonusMinPoints: parseInt(e.target.value) || 1})}
                          className="w-14 bg-slate-800 border border-slate-700 rounded-lg px-1.5 py-1.5 text-center text-sm" disabled={isLocked} />
                        <span className="text-xs text-slate-500">~</span>
                        <input type="number" min="1" max="500"
                          value={props.advancedPoints.bonusMaxPoints}
                          onChange={e => props.setAdvancedPoints({...props.advancedPoints, bonusMaxPoints: parseInt(e.target.value) || 1})}
                          className="w-14 bg-slate-800 border border-slate-700 rounded-lg px-1.5 py-1.5 text-center text-sm" disabled={isLocked} />
                        <span className="text-xs text-slate-500">P</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════ Theme Tab ═══════ */}
          {activeTab === 'theme' && (
            <div className="space-y-3">
              {THEME_OPTIONS.map(theme => (
                <button
                  key={theme.id}
                  onClick={() => props.setCurrentTheme(theme.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                    props.currentTheme === theme.id
                      ? 'border-sky-500 bg-sky-500/10'
                      : 'border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl shadow-lg shrink-0"
                    style={{ background: theme.preview }} />
                  <div className="text-left">
                    <div className="font-bold text-white flex items-center gap-2">
                      {theme.emoji} {theme.name}
                      {props.currentTheme === theme.id && <Check size={16} className="text-sky-400" />}
                    </div>
                    <div className="text-xs text-slate-400">{theme.description}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ═══════ Users Tab ═══════ */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400 font-bold">등록된 사용자</span>
                <button onClick={handleAddUser}
                  className="flex items-center gap-1 px-3 py-1.5 bg-sky-500/20 text-sky-400 rounded-lg text-sm font-bold hover:bg-sky-500/30 transition-colors">
                  <Plus size={14} /> 추가
                </button>
              </div>

              <div className="space-y-2">
                {users.map(user => (
                  <div key={user.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      props.activeUserId === user.id ? 'border-sky-500 bg-sky-500/10' : 'border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <button onClick={() => props.onSwitchUser(user.id)} className="text-2xl">
                      {user.avatar}
                    </button>
                    <div className="flex-1 min-w-0">
                      {editingUser === user.id ? (
                        <div className="flex gap-1">
                          <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                            className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm"
                            autoFocus onKeyDown={e => e.key === 'Enter' && handleSaveUserName(user.id)} />
                          <button onClick={() => handleSaveUserName(user.id)} className="p-1 text-emerald-400">
                            <Check size={16} />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => props.onSwitchUser(user.id)} className="text-left w-full">
                          <div className="font-bold text-sm text-white truncate">{user.name}</div>
                          {props.activeUserId === user.id && <div className="text-[10px] text-sky-400">현재 사용 중</div>}
                        </button>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => { setEditingUser(user.id); setEditName(user.name); }}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400"><Pencil size={14} /></button>
                      <button onClick={() => handleDeleteUser(user.id)}
                        className="p-1.5 hover:bg-rose-500/20 rounded-lg text-rose-400"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════ Admin Tab ═══════ */}
          {activeTab === 'admin' && (
            <div className="space-y-5">
              {/* PIN Lock Toggle */}
              <div className="space-y-3">
                <Toggle value={props.parentLockEnabled} onChange={props.setParentLockEnabled} label="🔐 부모 잠금 활성화" />
                {props.parentLockEnabled && (
                  <div className="space-y-2 pl-4">
                    <label className="text-xs text-slate-500 font-bold">비밀번호 (PIN)</label>
                    <div className="flex gap-2">
                      <input type={showPin ? 'text' : 'password'} value={props.parentPin}
                        onChange={e => props.setParentPin(e.target.value)}
                        placeholder="PIN 설정"
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
                      <button onClick={() => setShowPin(!showPin)} className="p-2 text-slate-400">
                        {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {!adminUnlocked && (
                      <div className="flex gap-2 mt-2">
                        <input type="password" value={pinInput} onChange={e => setPinInput(e.target.value)}
                          placeholder="PIN 입력하여 잠금 해제"
                          onKeyDown={e => e.key === 'Enter' && handlePinCheck()}
                          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
                        <button onClick={handlePinCheck} className="btn-premium px-4 py-2 rounded-lg text-sm font-bold">해제</button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* API Config */}
              <div className="border-t border-slate-800 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-slate-300 font-bold">AI 제공자 선택 및 API 키 설정</label>
                </div>
                <div className="flex gap-2">
                  {['gemini', 'openai', 'claude'].map(p => (
                    <button key={p} onClick={() => props.setAiProvider(p)}
                      className={`flex-1 py-2 rounded-xl border text-sm font-bold transition-all ${
                        props.aiProvider === p ? 'bg-sky-500/20 border-sky-500/50 text-sky-300' : 'bg-slate-800/50 border-slate-700 text-slate-400'
                      }`}>
                      {p === 'gemini' ? '🟦 Gemini' : p === 'openai' ? '🟩 OpenAI' : '🟧 Claude'}
                    </button>
                  ))}
                </div>
                
                {/* AI Provider Descriptions */}
                <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-xl mt-2">
                  {props.aiProvider === 'gemini' && (
                    <div className="text-sm text-slate-300">
                      <p className="font-bold text-sky-400 mb-1">🟦 Google Gemini</p>
                      <p className="text-xs mb-2 text-slate-400">구글의 최신 AI 모델입니다. 무료 할당량이 넉넉하여 처음 사용하시기 좋습니다.</p>
                      <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-xs text-sky-400 hover:underline flex items-center gap-1">
                        👉 Gemini API 키 무료 발급받기
                      </a>
                    </div>
                  )}
                  {props.aiProvider === 'openai' && (
                    <div className="text-sm text-slate-300">
                      <p className="font-bold text-emerald-400 mb-1">🟩 OpenAI (ChatGPT)</p>
                      <p className="text-xs mb-2 text-slate-400">가장 널리 쓰이는 AI 모델(GPT-4o 등)입니다. 사용한 만큼 비용이 발생합니다.</p>
                      <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-400 hover:underline flex items-center gap-1">
                        👉 OpenAI API 키 발급받기
                      </a>
                    </div>
                  )}
                  {props.aiProvider === 'claude' && (
                    <div className="text-sm text-slate-300">
                      <p className="font-bold text-orange-400 mb-1">🟧 Anthropic Claude</p>
                      <p className="text-xs mb-2 text-slate-400">자연스럽고 문맥을 잘 파악하는 뛰어난 AI 모델(Claude 3.5 등)입니다.</p>
                      <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-xs text-orange-400 hover:underline flex items-center gap-1">
                        👉 Claude API 키 발급받기
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-slate-300 font-bold">API 키</label>
                <div className="flex gap-2">
                  <input type={showApiKey ? 'text' : 'password'} value={props.apiKey}
                    onChange={e => props.setApiKey(e.target.value)} placeholder="API 키 입력..."
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono" />
                  <button onClick={() => setShowApiKey(!showApiKey)} className="p-2 text-slate-400">
                    {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={props.onFetchModels} className="flex-1 btn-premium px-4 py-2 rounded-xl text-sm font-bold">
                  모델 가져오기
                </button>
                <button onClick={props.onTestConnection}
                  className="flex items-center gap-1 px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-bold hover:bg-emerald-500/30 transition-colors">
                  <Wifi size={14} /> 연결 테스트
                </button>
              </div>

              {props.availableModels.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm text-slate-300 font-bold">모델 선택</label>
                  <select value={props.selectedModel}
                    onChange={e => props.setSelectedModel(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm">
                    {props.availableModels.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              )}

              {/* Reset buttons */}
              <div className="border-t border-slate-800 pt-4 space-y-2">
                <label className="text-sm text-slate-300 font-bold flex items-center gap-2"><RefreshCw size={14} /> 초기화</label>
                <div className="grid grid-cols-4 gap-2">
                  <button onClick={props.onResetPoints}
                    className="py-2 px-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl text-xs font-bold hover:bg-amber-500/20 transition-colors">
                    포인트만
                  </button>
                  <button onClick={props.onResetHistory}
                    className="py-2 px-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold hover:bg-rose-500/20 transition-colors">
                    기록만
                  </button>
                  <button onClick={props.onResetSettings}
                    className="py-2 px-1 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-xl text-xs font-bold hover:bg-sky-500/20 transition-colors">
                    설정만
                  </button>
                  <button onClick={props.onResetAll}
                    className="py-2 px-1 bg-red-600/20 text-red-400 border border-red-600/30 rounded-xl text-xs font-bold hover:bg-red-600/30 transition-colors">
                    전체
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
