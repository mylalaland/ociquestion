'use client';
// Vercel trigger: force rebuild on master
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Key, FileText, BrainCircuit, ChevronRight, CheckCircle2, RotateCcw, Download, Camera, Settings, X, Book, HelpCircle, Home as HomeIcon, Lock, ShieldCheck, AlertTriangle, Eye, EyeOff, Trash2 } from 'lucide-react';
import { GeminiProvider } from '@/lib/ai/gemini-provider';
import { OpenAIProvider } from '@/lib/ai/openai-provider';
import { ClaudeProvider } from '@/lib/ai/claude-provider';
import { extractTextFromPdf } from '@/lib/pdf/pdf-processor';
import { QuizResult, PointConfig, DEFAULT_POINT_CONFIG } from '@/lib/ai/types';
import QuizView from '@/components/quiz/QuizView';
import QuizResultScreen from '@/components/quiz/QuizResultScreen';
import FullTextHighlight from '@/components/viewer/FullTextHighlight';
import CameraPreview from '@/components/shared/CameraPreview';
import { saveQuizHistory, getAllQuizHistory, QuizHistory, PointLog, savePointLog, getPointLogs } from '@/lib/storage/history-store';

// ========== Utility: SHA-256 hash ==========
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ========== Loading tips ==========
const LOADING_TIPS = [
  "💡 알고 계셨나요? 수능형 문제가 가장 만들기 어려워요!",
  "💡 페이지가 많을수록 더 다양한 문제가 나와요!",
  "💡 난이도를 '어려움'으로 하면 더 깊은 사고력 문제가 나와요!",
  "💡 서술형 문제는 모범 답안과 비교해서 스스로 채점해요!",
  "💡 오답을 틀리면 원문 근거를 꼭 확인해 보세요!",
  "💡 포인트를 모아서 부모님께 자랑해 보세요!",
  "💡 카메라로 교과서를 찍으면 바로 퀴즈를 만들 수 있어요!",
];

// ========== Loading stage messages ==========
function getLoadingStage(seconds: number): { emoji: string; message: string } {
  if (seconds < 3) return { emoji: '📄', message: '문서를 분석하고 있어요...' };
  if (seconds < 8) return { emoji: '🧠', message: 'AI가 핵심 내용을 파악하고 있어요...' };
  if (seconds < 15) return { emoji: '✍️', message: '문제를 만들고 있어요...' };
  if (seconds < 30) return { emoji: '🔍', message: '정답과 해설을 검증하고 있어요...' };
  return { emoji: '⏳', message: '조금만 더 기다려 주세요... 문서가 길면 시간이 더 걸릴 수 있어요!' };
}

export default function Home() {
  // ─── Core State ───
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-1.5-flash');
  
  // ─── Active Provider State ───
  const [activeProvider, setActiveProvider] = useState<'gemini' | 'openai' | 'claude'>('gemini');
  const [apiKeyGemini, setApiKeyGemini] = useState('');
  const [apiKeyOpenai, setApiKeyOpenai] = useState('');
  const [apiKeyClaude, setApiKeyClaude] = useState('');
  const [modelGemini, setModelGemini] = useState('gemini-flash-latest');
  const [modelOpenai, setModelOpenai] = useState('gpt-4o-mini');
  const [modelClaude, setModelClaude] = useState('claude-3-5-sonnet-latest');
  const [discoveredGemini, setDiscoveredGemini] = useState<string[]>([]);
  const [discoveredOpenai, setDiscoveredOpenai] = useState<string[]>([]);
  const [discoveredClaude, setDiscoveredClaude] = useState<string[]>([]);

  // Synchronize active apiKey & selectedModel when provider or keys change
  useEffect(() => {
    if (activeProvider === 'gemini') {
      setApiKey(apiKeyGemini);
      setSelectedModel(modelGemini);
    } else if (activeProvider === 'openai') {
      setApiKey(apiKeyOpenai);
      setSelectedModel(modelOpenai);
    } else if (activeProvider === 'claude') {
      setApiKey(apiKeyClaude);
      setSelectedModel(modelClaude);
    }
  }, [activeProvider, apiKeyGemini, apiKeyOpenai, apiKeyClaude, modelGemini, modelOpenai, modelClaude]);

  const [numQuestions, setNumQuestions] = useState(5);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['CSAT', 'MULTIPLE_CHOICE', 'SHORT_ANSWER', 'ESSAY']);
  const [difficulty, setDifficulty] = useState('보통');
  const [retryMultipleChoice, setRetryMultipleChoice] = useState(true);
  const [quizFontSize, setQuizFontSize] = useState('medium');
  const [showContextTiming, setShowContextTiming] = useState<'always' | 'after_quiz'>('always');
  const [subject, setSubject] = useState('과목 없음');
  
  // ─── Point System ───
  const [passThreshold, setPassThreshold] = useState(80);
  const [pointConfig, setPointConfig] = useState<PointConfig>(DEFAULT_POINT_CONFIG);
  const [autoResetPoints, setAutoResetPoints] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);
  const [pointLogs, setPointLogs] = useState<PointLog[]>([]);
  const [showPointAnalysis, setShowPointAnalysis] = useState(false);
  
  // ─── Guardian Locks & Target Goals ───
  const [lockRetry, setLockRetry] = useState(false);
  const [lockFontSize, setLockFontSize] = useState(false);
  const [lockContextTiming, setLockContextTiming] = useState(false);
  const [targetPoints, setTargetPoints] = useState(1000);
  const [pointModalTab, setPointModalTab] = useState<'goal' | 'chart' | 'logs'>('goal');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  
  // ─── Password Protection ───
  const [parentPasswordHash, setParentPasswordHash] = useState<string | null>(null);
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  
  // ─── File & Processing ───
  const [files, setFiles] = useState<{file: File, startPage?: number, endPage?: number}[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [processingSeconds, setProcessingSeconds] = useState(0);
  const [loadingTipIndex, setLoadingTipIndex] = useState(0);
  
  // ─── App / Quiz ───
  const [step, setStep] = useState(1);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [fullText, setFullText] = useState('');
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null);
  const [wrongQuestions, setWrongQuestions] = useState<Set<string>>(new Set());
  const [halfPointQuestions, setHalfPointQuestions] = useState<Set<string>>(new Set());
  const [correctQuestions, setCorrectQuestions] = useState<Set<string>>(new Set());
  const [mobileTab, setMobileTab] = useState<'quiz' | 'context'>('quiz');
  const [showSettings, setShowSettings] = useState(false);
  const [uploadMode, setUploadMode] = useState<'file' | 'camera'>('file');
  const [showCamera, setShowCamera] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<QuizHistory[]>([]);
  const [historySortOrder, setHistorySortOrder] = useState<'desc' | 'asc'>('desc');
  const [historyFilterSubject, setHistoryFilterSubject] = useState<string>('all');
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editingSubjectText, setEditingSubjectText] = useState<string>('');
  const [showApiHelp, setShowApiHelp] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'admin'>('general');
  
  const [currentQuizId, setCurrentQuizId] = useState<string | null>(null);
  const [isQuizFinalized, setIsQuizFinalized] = useState(false);
  const [showResultScreen, setShowResultScreen] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);

  // ═══════════════════════════════════════
  // Load settings on mount
  // ═══════════════════════════════════════
  useEffect(() => {
    const savedKey = localStorage.getItem('OCI_QUIZ_API_KEY');
    const savedModel = localStorage.getItem('OCI_QUIZ_MODEL');
    if (savedKey) setApiKey(savedKey);
    if (savedModel) setSelectedModel(savedModel);

    const savedProvider = localStorage.getItem('OCI_QUIZ_PROVIDER');
    if (savedProvider) setActiveProvider(savedProvider as 'gemini' | 'openai' | 'claude');

    const savedKeyGemini = localStorage.getItem('OCI_QUIZ_API_KEY_GEMINI') || savedKey || '';
    const savedKeyOpenai = localStorage.getItem('OCI_QUIZ_API_KEY_OPENAI') || '';
    const savedKeyClaude = localStorage.getItem('OCI_QUIZ_API_KEY_CLAUDE') || '';
    if (savedKeyGemini) setApiKeyGemini(savedKeyGemini);
    if (savedKeyOpenai) setApiKeyOpenai(savedKeyOpenai);
    if (savedKeyClaude) setApiKeyClaude(savedKeyClaude);

    const savedModelGemini = localStorage.getItem('OCI_QUIZ_MODEL_GEMINI') || savedModel || 'gemini-1.5-flash';
    const savedModelOpenai = localStorage.getItem('OCI_QUIZ_MODEL_OPENAI') || 'gpt-4o-mini';
    const savedModelClaude = localStorage.getItem('OCI_QUIZ_MODEL_CLAUDE') || 'claude-3-5-sonnet-latest';
    if (savedModelGemini) setModelGemini(savedModelGemini);
    if (savedModelOpenai) setModelOpenai(savedModelOpenai);
    if (savedModelClaude) setModelClaude(savedModelClaude);

    const savedDiscGemini = localStorage.getItem('OCI_QUIZ_DISCOVERED_GEMINI');
    const savedDiscOpenai = localStorage.getItem('OCI_QUIZ_DISCOVERED_OPENAI');
    const savedDiscClaude = localStorage.getItem('OCI_QUIZ_DISCOVERED_CLAUDE');
    if (savedDiscGemini) setDiscoveredGemini(JSON.parse(savedDiscGemini));
    if (savedDiscOpenai) setDiscoveredOpenai(JSON.parse(savedDiscOpenai));
    if (savedDiscClaude) setDiscoveredClaude(JSON.parse(savedDiscClaude));

    const savedNum = localStorage.getItem('OCI_QUIZ_NUM_QUESTIONS');
    const savedTypes = localStorage.getItem('OCI_QUIZ_TYPES');
    const savedDiff = localStorage.getItem('OCI_QUIZ_DIFFICULTY');
    const savedRetry = localStorage.getItem('OCI_QUIZ_RETRY_CHOICE');
    const savedFont = localStorage.getItem('OCI_QUIZ_FONT_SIZE');
    const savedContextTiming = localStorage.getItem('OCI_QUIZ_CONTEXT_TIMING');

    if (savedNum) setNumQuestions(parseInt(savedNum));
    if (savedTypes) setSelectedTypes(JSON.parse(savedTypes));
    if (savedDiff) setDifficulty(savedDiff);
    if (savedRetry) setRetryMultipleChoice(savedRetry === 'true');
    if (savedFont) setQuizFontSize(savedFont);
    if (savedContextTiming) setShowContextTiming(savedContextTiming as 'always' | 'after_quiz');

    const savedThreshold = localStorage.getItem('OCI_QUIZ_PASS_THRESHOLD');
    const savedPointConfig = localStorage.getItem('OCI_QUIZ_POINT_CONFIG');
    const savedAutoReset = localStorage.getItem('OCI_QUIZ_AUTO_RESET');
    const savedTotalPoints = localStorage.getItem('OCI_QUIZ_TOTAL_POINTS');
    const savedLastMonth = localStorage.getItem('OCI_QUIZ_LAST_MONTH');
    const savedPwHash = localStorage.getItem('OCI_QUIZ_PARENT_PW');

    if (savedThreshold) setPassThreshold(parseInt(savedThreshold));
    if (savedPointConfig) setPointConfig(JSON.parse(savedPointConfig));
    if (savedAutoReset) setAutoResetPoints(savedAutoReset === 'true');
    if (savedPwHash) setParentPasswordHash(savedPwHash);
    
    const currentMonth = new Date().getMonth().toString();
    if (savedAutoReset === 'true' && savedLastMonth && savedLastMonth !== currentMonth) {
      setTotalPoints(0);
      localStorage.setItem('OCI_QUIZ_TOTAL_POINTS', '0');
    } else if (savedTotalPoints) {
      setTotalPoints(parseInt(savedTotalPoints));
    }
    localStorage.setItem('OCI_QUIZ_LAST_MONTH', currentMonth);

    const savedLockRetry = localStorage.getItem('OCI_QUIZ_LOCK_RETRY');
    const savedLockFont = localStorage.getItem('OCI_QUIZ_LOCK_FONT_SIZE');
    const savedLockTiming = localStorage.getItem('OCI_QUIZ_LOCK_CONTEXT_TIMING');
    const savedTargetPoints = localStorage.getItem('OCI_QUIZ_TARGET_POINTS');

    if (savedLockRetry) setLockRetry(savedLockRetry === 'true');
    if (savedLockFont) setLockFontSize(savedLockFont === 'true');
    if (savedLockTiming) setLockContextTiming(savedLockTiming === 'true');
    if (savedTargetPoints) setTargetPoints(parseInt(savedTargetPoints));

    const savedTheme = localStorage.getItem('OCI_QUIZ_THEME');
    if (savedTheme) setTheme(savedTheme as 'light' | 'dark' | 'system');

    setPointLogs(getPointLogs());
  }, []);

  // ═══════════════════════════════════════
  // Processing timer
  // ═══════════════════════════════════════
  useEffect(() => {
    if (!isProcessing) {
      setProcessingSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      setProcessingSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isProcessing]);

  useEffect(() => {
    if (!isProcessing) return;
    const interval = setInterval(() => {
      setLoadingTipIndex(prev => (prev + 1) % LOADING_TIPS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isProcessing]);

  // ═══════════════════════════════════════
  // Auto-save settings
  // ═══════════════════════════════════════
  useEffect(() => {
    localStorage.setItem('OCI_QUIZ_NUM_QUESTIONS', numQuestions.toString());
    localStorage.setItem('OCI_QUIZ_TYPES', JSON.stringify(selectedTypes));
    localStorage.setItem('OCI_QUIZ_DIFFICULTY', difficulty);
    localStorage.setItem('OCI_QUIZ_RETRY_CHOICE', retryMultipleChoice.toString());
    localStorage.setItem('OCI_QUIZ_FONT_SIZE', quizFontSize);
    localStorage.setItem('OCI_QUIZ_CONTEXT_TIMING', showContextTiming);
  }, [numQuestions, selectedTypes, difficulty, retryMultipleChoice, quizFontSize, showContextTiming]);

  useEffect(() => {
    localStorage.setItem('OCI_QUIZ_PASS_THRESHOLD', passThreshold.toString());
    localStorage.setItem('OCI_QUIZ_POINT_CONFIG', JSON.stringify(pointConfig));
    localStorage.setItem('OCI_QUIZ_AUTO_RESET', autoResetPoints.toString());
    localStorage.setItem('OCI_QUIZ_TOTAL_POINTS', totalPoints.toString());
  }, [passThreshold, pointConfig, autoResetPoints, totalPoints]);

  useEffect(() => {
    localStorage.setItem('OCI_QUIZ_LOCK_RETRY', lockRetry.toString());
    localStorage.setItem('OCI_QUIZ_LOCK_FONT_SIZE', lockFontSize.toString());
    localStorage.setItem('OCI_QUIZ_LOCK_CONTEXT_TIMING', lockContextTiming.toString());
    localStorage.setItem('OCI_QUIZ_TARGET_POINTS', targetPoints.toString());
  }, [lockRetry, lockFontSize, lockContextTiming, targetPoints]);

  useEffect(() => {
    localStorage.setItem('OCI_QUIZ_THEME', theme);
    const applyTheme = (t: 'light' | 'dark' | 'system') => {
      const root = document.documentElement;
      if (t === 'light') {
        root.classList.add('light');
        root.classList.remove('dark');
      } else if (t === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
      } else {
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (systemDark) {
          root.classList.add('dark');
          root.classList.remove('light');
        } else {
          root.classList.add('light');
          root.classList.remove('dark');
        }
      }
    };
    
    applyTheme(theme);
    
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => {
        const root = document.documentElement;
        if (e.matches) {
          root.classList.add('dark');
          root.classList.remove('light');
        } else {
          root.classList.add('light');
          root.classList.remove('dark');
        }
      };
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [theme]);

  // ═══════════════════════════════════════
  // Handlers
  // ═══════════════════════════════════════
  const loadHistory = async () => {
    try {
      const data = await getAllQuizHistory();
      setHistoryList(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (e) {
      console.error(e);
    }
  };

  const saveAllSettings = () => {
    localStorage.setItem('OCI_QUIZ_PROVIDER', activeProvider);
    
    // Save Gemini keys & models
    const sanGemini = apiKeyGemini.trim().replace(/[^\x20-\x7E]/g, '');
    localStorage.setItem('OCI_QUIZ_API_KEY_GEMINI', sanGemini);
    localStorage.setItem('OCI_QUIZ_MODEL_GEMINI', modelGemini);
    localStorage.setItem('OCI_QUIZ_DISCOVERED_GEMINI', JSON.stringify(discoveredGemini));

    // For backwards compatibility, set active one as OCI_QUIZ_API_KEY / MODEL
    if (activeProvider === 'gemini') {
      localStorage.setItem('OCI_QUIZ_API_KEY', sanGemini);
      localStorage.setItem('OCI_QUIZ_MODEL', modelGemini);
      setApiKey(sanGemini);
      setSelectedModel(modelGemini);
    }

    // Save OpenAI
    const sanOpenai = apiKeyOpenai.trim().replace(/[^\x20-\x7E]/g, '');
    localStorage.setItem('OCI_QUIZ_API_KEY_OPENAI', sanOpenai);
    localStorage.setItem('OCI_QUIZ_MODEL_OPENAI', modelOpenai);
    localStorage.setItem('OCI_QUIZ_DISCOVERED_OPENAI', JSON.stringify(discoveredOpenai));

    if (activeProvider === 'openai') {
      localStorage.setItem('OCI_QUIZ_API_KEY', sanOpenai);
      localStorage.setItem('OCI_QUIZ_MODEL', modelOpenai);
      setApiKey(sanOpenai);
      setSelectedModel(modelOpenai);
    }

    // Save Claude
    const sanClaude = apiKeyClaude.trim().replace(/[^\x20-\x7E]/g, '');
    localStorage.setItem('OCI_QUIZ_API_KEY_CLAUDE', sanClaude);
    localStorage.setItem('OCI_QUIZ_MODEL_CLAUDE', modelClaude);
    localStorage.setItem('OCI_QUIZ_DISCOVERED_CLAUDE', JSON.stringify(discoveredClaude));

    if (activeProvider === 'claude') {
      localStorage.setItem('OCI_QUIZ_API_KEY', sanClaude);
      localStorage.setItem('OCI_QUIZ_MODEL', modelClaude);
      setApiKey(sanClaude);
      setSelectedModel(modelClaude);
    }
  };

  const handleDiscoverModels = async () => {
    setIsDiscovering(true);
    try {
      if (activeProvider === 'gemini') {
        if (!apiKeyGemini) { alert('API 키가 입력되지 않았습니다.'); return; }
        const provider = new GeminiProvider(apiKeyGemini);
        const models = await provider.getAvailableModels();
        setDiscoveredGemini(models);
        
        // Recommend/select default Flash
        const defaultFlash = models.find(m => m.includes('1.5-flash')) || models.find(m => m.includes('2.5-flash')) || models.find(m => m.includes('1.5-pro'));
        if (defaultFlash) {
          setModelGemini(defaultFlash);
        } else if (models.length > 0 && !models.includes(modelGemini)) {
          setModelGemini(models[0]);
        }
        alert(`총 ${models.length}개의 Gemini 모델을 조회하여 반영했습니다.`);
      } else if (activeProvider === 'openai') {
        if (!apiKeyOpenai) { alert('API 키가 입력되지 않았습니다.'); return; }
        const provider = new OpenAIProvider(apiKeyOpenai);
        const models = await provider.getAvailableModels();
        setDiscoveredOpenai(models);
        
        const defaultGpt = models.find(m => m.includes('gpt-4o-mini')) || models.find(m => m.includes('gpt-4o'));
        if (defaultGpt) {
          setModelOpenai(defaultGpt);
        } else if (models.length > 0 && !models.includes(modelOpenai)) {
          setModelOpenai(models[0]);
        }
        alert(`총 ${models.length}개의 OpenAI 모델을 조회하여 반영했습니다.`);
      } else if (activeProvider === 'claude') {
        const claudeModels = [
          'claude-3-5-sonnet-latest',
          'claude-3-5-haiku-latest',
          'claude-3-opus-latest',
          'claude-3-sonnet',
          'claude-3-haiku'
        ];
        setDiscoveredClaude(claudeModels);
        setModelClaude('claude-3-5-sonnet-latest');
        alert(`Anthropic Claude의 추천 모델 목록 5개를 성공적으로 로드했습니다.`);
      }
    } catch (error: unknown) {
      console.error(error);
      const err = error as Error;
      alert(`모델 조회 실패: ${err.message || '알 수 없는 오류'}\nAPI 키가 올바른지 확인해 주세요.`);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      if (activeProvider === 'gemini') {
        if (!apiKeyGemini) { alert('Gemini API 키가 입력되지 않았습니다.'); return; }
        const provider = new GeminiProvider(apiKeyGemini, modelGemini);
        await provider.testConnection();
        alert('Gemini 연결 성공! 모델이 정상적으로 작동합니다.');
      } else if (activeProvider === 'openai') {
        if (!apiKeyOpenai) { alert('OpenAI API 키가 입력되지 않았습니다.'); return; }
        const provider = new OpenAIProvider(apiKeyOpenai, modelOpenai);
        await provider.testConnection();
        alert('OpenAI 연결 성공! 모델이 정상적으로 작동합니다.');
      } else if (activeProvider === 'claude') {
        if (!apiKeyClaude) { alert('Claude API 키가 입력되지 않았습니다.'); return; }
        const provider = new ClaudeProvider(apiKeyClaude, modelClaude);
        await provider.testConnection();
        alert('Claude 연결 성공! 모델이 정상적으로 작동합니다.');
      }
    } catch (error: unknown) {
      console.error(error);
      const err = error as Error;
      alert(`연결 실패: ${err.message || '알 수 없는 오류'}\nAPI 키와 모델 선택을 확인해 주세요.`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleStart = async () => {
    if (!apiKey || files.length === 0 || selectedTypes.length === 0) return;
    setIsProcessing(true);
    setShowCamera(false);
    try {
      let combinedText = '';
      
      const pdfFiles = files.filter(f => f.file.type === 'application/pdf');
      const imageFiles = files.filter(f => f.file.type.startsWith('image/')).map(f => f.file);

      for (const pdfItem of pdfFiles) {
        const pages = await extractTextFromPdf(pdfItem.file, pdfItem.startPage, pdfItem.endPage);
        combinedText += pages.map(p => p.text).join('\n') + '\n';
      }

      if (imageFiles.length > 0) {
        combinedText += `[${imageFiles.length}개의 이미지 분석]\n`;
        setImageUrls(imageFiles.map(file => URL.createObjectURL(file)));
      } else {
        setImageUrls([]);
      }

      setFullText(combinedText);
      
      let result;
      if (activeProvider === 'openai') {
        const provider = new OpenAIProvider(apiKey, selectedModel);
        result = await provider.generateQuiz(combinedText, selectedTypes, numQuestions, difficulty);
      } else if (activeProvider === 'claude') {
        const provider = new ClaudeProvider(apiKey, selectedModel);
        result = await provider.generateQuiz(combinedText, selectedTypes, numQuestions, difficulty);
      } else {
        const provider = new GeminiProvider(apiKey, selectedModel);
        result = await provider.generateQuiz(combinedText, selectedTypes, imageFiles, numQuestions, difficulty);
      }
      
      if (result.extractedText) {
        setFullText(prev => prev + "\n\n=== 📷 이미지에서 추출된 원문 텍스트 ===\n" + result.extractedText);
      }
      
      setQuizResult(result);
      setWrongQuestions(new Set());
      setCorrectQuestions(new Set());
      setHalfPointQuestions(new Set());
      setStep(3);
      setIsQuizFinalized(false);
      setShowResultScreen(false);
      
      const newHistory: QuizHistory = {
        id: Math.random().toString(36).substr(2, 9),
        title: result.title,
        subject: subject,
        date: new Date().toISOString(),
        totalQuestions: result.questions.length,
        correctAnswers: 0,
        wrongQuestions: [],
        quizResult: result,
        difficulty: difficulty,
        isFinalized: false,
        score: 0,
        pointsEarned: 0
      };
      
      await saveQuizHistory(newHistory);
      setCurrentQuizId(newHistory.id);
      
    } catch (error: unknown) {
      console.error("AI Quiz Generation Error:", error);
      const err = error as { message?: string; status?: number };
      const errStr = String(err.message || error).toLowerCase();
      
      if (errStr.includes("503") || err.status === 503) {
        alert("현재 Google 서버에 요청이 몰려 응답이 지연되고 있습니다. (Error 503)\n잠시 후 다시 시도하시거나, 다른 모델(예: 1.5 Flash)로 변경해 보세요.");
      } else if (errStr.includes("quota") || errStr.includes("429") || errStr.includes("exhausted") || err.status === 429) {
        alert("🚨 API 크레딧 또는 할당량을 모두 소진했습니다!\nGoogle AI Studio에서 잔여 한도를 확인하시거나 과금이 필요할 수 있습니다.");
      } else if (errStr.includes("api key") || errStr.includes("400") || errStr.includes("invalid") || err.status === 400) {
        alert("🚨 API 키가 유효하지 않습니다.\n설정에서 정확한 Gemini API 키를 다시 한 번 붙여넣어 주세요.");
      } else {
        alert(`문제 생성 중 알 수 없는 오류가 발생했습니다.\n\n상세내용: ${err.message || String(error)}\n네트워크나 설정을 확인해 주세요.`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportTxt = () => {
    if (!quizResult) return;
    try {
      let txt = `[ ${quizResult.title} ]\n`;
      txt += `${quizResult.summary}\n`;
      txt += `=========================================\n\n`;
      
      quizResult.questions.forEach((q, i) => {
        txt += `Q${i + 1}. [${q.type}]\n`;
        txt += `${q.question}\n\n`;
        if (q.options && q.options.length > 0) {
          q.options.forEach((opt, j) => {
            txt += `  ${j + 1}) ${opt}\n`;
          });
          txt += '\n';
        }
        txt += `📝 정답: ${q.correctAnswer}\n`;
        txt += `💡 해설: ${q.explanation}\n`;
        txt += `-----------------------------------------\n\n`;
      });

      const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${quizResult.title}.txt`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const error = err as Error;
      alert("TXT 다운로드 중 오류가 발생했습니다: " + error.message);
    }
  };

  const handleExportPdf = async () => {
    try {
      if (!quizResult) return;
      const { default: jsPDF } = await import('jspdf');
      const htmlToImage = await import('html-to-image');
      const element = document.getElementById('quiz-content');
      
      if (!element) {
        alert("퀴즈 내용을 찾을 수 없습니다.");
        return;
      }

      const originalBg = element.style.background;
      const originalPadding = element.style.padding;
      const originalRadius = element.style.borderRadius;
      
      element.style.background = '#020617';
      element.style.padding = '32px';
      element.style.borderRadius = '24px';

      await new Promise(r => setTimeout(r, 600));

      const imgData = await htmlToImage.toPng(element, {
        backgroundColor: '#020617', 
        pixelRatio: 2,
      });

      element.style.background = originalBg;
      element.style.padding = originalPadding;
      element.style.borderRadius = originalRadius;

      if (!imgData || imgData === 'data:,') throw new Error("이미지 렌더링에 실패했습니다.");

      const doc = new jsPDF('p', 'mm', 'a4');
      const imgProps = doc.getImageProperties(imgData);
      const pdfWidth = doc.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = doc.internal.pageSize.getHeight();

      doc.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        doc.addPage();
        doc.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      doc.save(`${quizResult.title}.pdf`);
    } catch (err: unknown) {
      console.error("PDF Export Error:", err);
      const error = err as Error;
      alert("PDF 내보내기 중 에러가 발생했습니다: " + (error.message || '알 수 없는 에러'));
    }
  };

  const handleCorrect = (qId: string, opts?: { halfPoints?: boolean }) => {
    setCorrectQuestions(prev => new Set(Array.from(prev).concat(qId)));
    if (opts?.halfPoints) {
      setHalfPointQuestions(prev => new Set(Array.from(prev).concat(qId)));
    }
  };

  const handleWrong = (qId: string) => {
    setWrongQuestions(prev => new Set(Array.from(prev).concat(qId)));
  };

  const handleShowContext = (context: string) => {
    setActiveHighlight(context);
  };
  
  const handleFinalize = async (score: number) => {
    if (!currentQuizId || isQuizFinalized) return;
    const { getHistoryById, saveQuizHistory } = await import('@/lib/storage/history-store');
    const history = await getHistoryById(currentQuizId);
    if (!history || !quizResult) return;
    
    // Calculate earned points per type
    let earned = 0;
    const requiredScore = Math.ceil((passThreshold / 100) * history.totalQuestions);
    const passed = score >= requiredScore;
    
    if (passed) {
      quizResult.questions.forEach(q => {
        if (correctQuestions.has(q.id)) {
          const base = pointConfig[q.type as keyof PointConfig] || 10;
          earned += halfPointQuestions.has(q.id) ? Math.floor(base * 0.5) : base;
        }
      });
    }
    
    history.score = score;
    history.correctAnswers = score;
    history.wrongQuestions = Array.from(wrongQuestions);
    history.isFinalized = true;
    history.pointsEarned = earned;

    await saveQuizHistory(history);
    
    // Save Point Log
    const newLog: PointLog = {
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString(),
      quizId: currentQuizId,
      quizTitle: history.title,
      subject: history.subject || '과목 없음',
      earnedPoints: earned,
      score: score,
      totalQuestions: history.totalQuestions
    };
    savePointLog(newLog);
    setPointLogs(prev => [newLog, ...prev.filter(l => l.quizId !== currentQuizId)]);

    if (earned > 0) {
      setTotalPoints(prev => prev + earned);
    }
    
    setEarnedPoints(earned);
    setIsQuizFinalized(true);
    setShowResultScreen(true);
  };

  // ─── Password handlers ───
  const handleSetPassword = async () => {
    if (!newPassword || newPassword.length < 4) {
      setPasswordError('비밀번호는 최소 4자 이상이어야 합니다.');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setPasswordError('비밀번호가 일치하지 않습니다.');
      return;
    }
    const hash = await sha256(newPassword);
    localStorage.setItem('OCI_QUIZ_PARENT_PW', hash);
    setParentPasswordHash(hash);
    setIsAdminUnlocked(true);
    setShowPasswordSetup(false);
    setNewPassword('');
    setNewPasswordConfirm('');
    setPasswordError('');
    setSettingsTab('admin');
  };

  const handleVerifyPassword = async () => {
    if (!passwordInput) return;
    const hash = await sha256(passwordInput);
    if (hash === parentPasswordHash) {
      setIsAdminUnlocked(true);
      setShowPasswordPrompt(false);
      setPasswordInput('');
      setPasswordError('');
      setSettingsTab('admin');
    } else {
      setPasswordError('비밀번호가 틀렸습니다.');
    }
  };

  const handleFactoryReset = () => {
    if (!confirm('⚠️ 정말로 모든 데이터를 초기화하시겠습니까?\n\nAPI 키, 비밀번호, 포인트, 설정 등 모든 것이 삭제됩니다.')) return;
    if (!confirm('⚠️ 이 작업은 되돌릴 수 없습니다!\n정말 진행하시겠습니까?')) return;
    
    const keys = Object.keys(localStorage).filter(k => k.startsWith('OCI_QUIZ_'));
    keys.forEach(k => localStorage.removeItem(k));
    
    // Also clear IndexedDB
    indexedDB.deleteDatabase('OciQuizHistoryDB');
    
    window.location.reload();
  };

  const handleAdminAccess = () => {
    setSettingsTab('admin');
    if (!parentPasswordHash) {
      setShowPasswordSetup(true);
    } else if (!isAdminUnlocked) {
      setShowPasswordPrompt(true);
    }
  };

  const goHome = useCallback(() => {
    setStep(1);
    setQuizResult(null);
    setShowResultScreen(false);
    setIsQuizFinalized(false);
    setFiles([]);
    setFullText('');
    setWrongQuestions(new Set());
    setCorrectQuestions(new Set());
    setHalfPointQuestions(new Set());
    setActiveHighlight(null);
    setMobileTab('quiz');
  }, []);

  // ═══════════════════════════════════════
  // RENDER: Processing / Loading Overlay
  // ═══════════════════════════════════════
  if (isProcessing) {
    const stage = getLoadingStage(processingSeconds);
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8 relative overflow-hidden">
        {/* Animated background particles */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="absolute w-2 h-2 bg-sky-500/20 rounded-full orbit-particle" 
              style={{ 
                top: '50%', left: '50%', 
                animationDelay: `${i * 0.5}s`, 
                animationDuration: `${3 + i * 0.5}s` 
              }} 
            />
          ))}
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-8 relative z-10 max-w-md"
        >
          {/* Big brain icon with pulse */}
          <div className="relative mx-auto w-32 h-32 flex items-center justify-center">
            <div className="absolute inset-0 bg-sky-500/10 rounded-full brain-pulse" />
            <div className="absolute inset-4 bg-sky-500/5 rounded-full brain-pulse" style={{ animationDelay: '0.5s' }} />
            <BrainCircuit size={64} className="text-sky-400 brain-pulse relative z-10" />
          </div>

          {/* Stage message */}
          <AnimatePresence mode="wait">
            <motion.div
              key={stage.message}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-2"
            >
              <div className="text-4xl">{stage.emoji}</div>
              <h2 className="text-xl font-bold text-white">{stage.message}</h2>
            </motion.div>
          </AnimatePresence>

          {/* Loading dots */}
          <div className="flex justify-center gap-2">
            <span className="loading-dot" />
            <span className="loading-dot" />
            <span className="loading-dot" />
          </div>

          {/* Timer */}
          <div className="glass px-6 py-3 rounded-2xl inline-flex items-center gap-3">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-slate-300 text-sm">경과 시간:</span>
            <span className="text-sky-400 font-bold font-mono text-lg">
              {Math.floor(processingSeconds / 60)}:{String(processingSeconds % 60).padStart(2, '0')}
            </span>
          </div>

          {/* Random tip */}
          <AnimatePresence mode="wait">
            <motion.p
              key={loadingTipIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-slate-500 text-sm max-w-xs mx-auto"
            >
              {LOADING_TIPS[loadingTipIndex]}
            </motion.p>
          </AnimatePresence>
        </motion.div>
      </main>
    );
  }

  // ═══════════════════════════════════════
  // RENDER: Quiz Result Screen
  // ═══════════════════════════════════════
  if (showResultScreen && quizResult) {
    const score = quizResult.questions.filter(q => correctQuestions.has(q.id)).length;
    const correctMap: Record<string, boolean> = {};
    const halfMap: Record<string, boolean> = {};
    quizResult.questions.forEach(q => {
      correctMap[q.id] = correctQuestions.has(q.id);
      halfMap[q.id] = halfPointQuestions.has(q.id);
    });

    return (
      <QuizResultScreen
        questions={quizResult.questions}
        correctMap={correctMap}
        halfPointMap={halfMap}
        score={score}
        totalQuestions={quizResult.questions.length}
        passThreshold={passThreshold}
        pointConfig={pointConfig}
        totalPointsBefore={totalPoints - earnedPoints}
        earnedPoints={earnedPoints}
        subject={subject}
        difficulty={difficulty}
        onGoHome={goHome}
        onRetry={() => { setShowResultScreen(false); setStep(1); }}
      />
    );
  }

  // ═══════════════════════════════════════
  // RENDER: Quiz View (Step 3)
  // ═══════════════════════════════════════
  if (step === 3 && quizResult) {
    return (
      <main className="min-h-screen bg-slate-950">
        {/* Top Nav Bar */}
        <nav className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50">
          <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={goHome} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors p-2 rounded-xl hover:bg-white/5">
                <HomeIcon size={20} />
                <span className="hidden md:inline text-sm font-bold">첫 화면</span>
              </button>
              <div className="h-5 w-px bg-slate-800" />
              <div className="flex items-center gap-2">
                <BrainCircuit size={16} className="text-sky-400" />
                <span className="text-sm font-bold shimmer-text">Lala Quiz</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  setShowPointAnalysis(true);
                  setShowHistory(false);
                  setShowSettings(false);
                }}
                className="glass px-3 py-1.5 rounded-xl flex items-center gap-2 hover:bg-white/10 active:scale-95 transition-all text-left focus:outline-none"
              >
                <span className="text-lg">🏆</span>
                <span className="text-sky-400 font-bold text-sm">{totalPoints} P</span>
              </button>
            </div>
          </div>
        </nav>

        <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-6">
          <header className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            <div>
              <div className="flex items-center gap-2 mb-2">
                 <span className="px-2 py-1 bg-slate-800 rounded-md text-xs font-bold text-sky-400">{subject}</span>
                 <h2 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400 leading-tight">
                   {quizResult.title}
                 </h2>
              </div>
              <p className="text-slate-400 mt-1 text-sm">{quizResult.summary}</p>
            </div>
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <button 
                onClick={handleExportPdf}
                className="flex-1 md:flex-none justify-center btn-premium px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"
              >
                <Download size={16} /> PDF
              </button>
              <button 
                onClick={handleExportTxt}
                className="flex-1 md:flex-none justify-center bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
              >
                <Download size={16} /> TXT
              </button>
            </div>
          </header>

          {/* Mobile Tabs */}
          <div className="flex lg:hidden bg-slate-900 rounded-xl p-1 border border-slate-800">
            <button 
              onClick={() => setMobileTab('quiz')} 
              className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${mobileTab === 'quiz' ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20' : 'text-slate-400 hover:text-slate-200'}`}
            >
              📝 퀴즈 풀이
            </button>
            <button 
              onClick={() => setMobileTab('context')} 
              className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${mobileTab === 'context' ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20' : 'text-slate-400 hover:text-slate-200'}`}
            >
              📖 원문 보기
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div 
              id="quiz-scroller"
              className={`space-y-6 overflow-y-auto pr-2 custom-scrollbar ${mobileTab === 'quiz' ? 'block' : 'hidden lg:block'}`}
              style={{ maxHeight: 'calc(100vh - 200px)' }}
            >
              <div id="quiz-content" className="pb-8">
                <QuizView 
                  questions={quizResult.questions}
                  onCorrect={handleCorrect} 
                  onWrong={handleWrong}
                  onShowContext={(ctx) => {
                    handleShowContext(ctx);
                    setMobileTab('context');
                  }}
                  retryMultipleChoice={retryMultipleChoice}
                  quizFontSize={quizFontSize}
                  showContextTiming={showContextTiming}
                  difficulty={difficulty}
                  isFinalized={isQuizFinalized}
                  onFinalize={handleFinalize}
                />
              </div>
            </div>
            
            <div className={`sticky top-24 ${mobileTab === 'context' ? 'block' : 'hidden lg:block'}`}>
              <FullTextHighlight 
                text={fullText} 
                highlights={[]} 
                activeHighlight={activeHighlight} 
                images={imageUrls}
              />
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ═══════════════════════════════════════
  // RENDER: Main / Home (Step 1)
  // ═══════════════════════════════════════
  return (
    <main className="min-h-screen flex flex-col items-center">
      {/* ── Top Navigation Bar ── */}
      <nav className="w-full sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrainCircuit size={20} className="text-sky-400" />
            <span className="font-bold shimmer-text text-sm tracking-wider">Lala Quiz</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                setShowPointAnalysis(true);
                setShowHistory(false);
                setShowSettings(false);
              }}
              className="glass px-3 py-1.5 rounded-xl flex items-center gap-2 hover:bg-white/10 active:scale-95 transition-all text-left focus:outline-none"
            >
              <span className="text-lg">🏆</span>
              <span className="text-sky-400 font-bold text-sm">{totalPoints} P</span>
            </button>
            <button 
              onClick={async () => {
                 if (!showHistory) await loadHistory();
                 setShowHistory(!showHistory);
                 setShowSettings(false);
              }}
              className="p-2.5 glass rounded-xl text-slate-400 hover:text-sky-400 transition-colors flex items-center gap-1.5"
            >
              <Book size={18} /> <span className="hidden md:inline text-xs font-bold">기록</span>
            </button>
            <button 
              onClick={() => {
                 setShowSettings(!showSettings);
                 setShowHistory(false);
                 setSettingsTab('general');
                 setIsAdminUnlocked(false);
              }}
              className="p-2.5 glass rounded-xl text-slate-400 hover:text-sky-400 transition-colors"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>
      </nav>

      {/* ── API Key Missing Banner ── */}
      <AnimatePresence>
        {!apiKey && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-5xl px-4 mt-4"
          >
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center shrink-0">
                  <Key size={20} className="text-amber-400" />
                </div>
                <div>
                  <h3 className="text-amber-300 font-bold text-sm">🔑 API 키가 아직 설정되지 않았어요!</h3>
                  <p className="text-amber-400/70 text-xs mt-0.5">문제를 만들려면 먼저 API 키(AI 출입증)를 설정해야 해요.</p>
                </div>
              </div>
              <button 
                onClick={() => { setShowSettings(true); setSettingsTab('admin'); setShowApiHelp(true); handleAdminAccess(); }}
                className="bg-amber-500 text-slate-900 font-bold px-4 py-2 rounded-xl text-sm hover:bg-amber-400 transition-colors whitespace-nowrap"
              >
                설정 방법 보기
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modals ── */}
      <AnimatePresence>
        {/* Point Analysis Modal */}
        {showPointAnalysis && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <div className="bg-slate-900/95 backdrop-blur-2xl p-6 md:p-8 rounded-[32px] border border-slate-700 w-full max-w-lg shadow-2xl relative max-h-[85vh] flex flex-col text-slate-100">
              {/* Header */}
              <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4 shrink-0">
                <h2 className="text-2xl font-bold flex items-center gap-2 text-white">
                  <span className="text-2xl">🏆</span> 포인트 리포트 & 분석
                </h2>
                <button 
                  onClick={() => setShowPointAnalysis(false)} 
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400"
                >
                  <X size={24} />
                </button>
              </div>

              {/* 3-Tab Selector */}
              <div className="flex bg-slate-950/60 p-1 rounded-2xl mb-6 border border-slate-800 shrink-0">
                <button 
                  onClick={() => setPointModalTab('goal')}
                  className={`flex-1 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${pointModalTab === 'goal' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'text-slate-400 hover:text-white'}`}
                >
                  목표 & 요약
                </button>
                <button 
                  onClick={() => setPointModalTab('chart')}
                  className={`flex-1 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${pointModalTab === 'chart' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'text-slate-400 hover:text-white'}`}
                >
                  성과 분석
                </button>
                <button 
                  onClick={() => setPointModalTab('logs')}
                  className={`flex-1 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${pointModalTab === 'logs' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'text-slate-400 hover:text-white'}`}
                >
                  상세 이력
                </button>
              </div>

              {/* Scrollable Container */}
              <div className="overflow-y-auto custom-scrollbar flex-1 pr-1 space-y-6">
                
                {/* ─── TAB 1: Goal & Stats Summary ─── */}
                {pointModalTab === 'goal' && (
                  <div className="space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-slate-800/40 border border-slate-800 p-3.5 rounded-2xl text-center">
                        <span className="text-slate-400 text-[10px] block mb-1">보유 포인트</span>
                        <strong className="text-sky-400 text-lg md:text-xl font-black font-mono">{totalPoints} P</strong>
                      </div>
                      <div className="bg-slate-800/40 border border-slate-800 p-3.5 rounded-2xl text-center">
                        <span className="text-slate-400 text-[10px] block mb-1">총 참여 횟수</span>
                        <strong className="text-indigo-400 text-lg md:text-xl font-black font-mono">{pointLogs.length}회</strong>
                      </div>
                      <div className="bg-slate-800/40 border border-slate-800 p-3.5 rounded-2xl text-center">
                        <span className="text-slate-400 text-[10px] block mb-1">평균 정답률</span>
                        <strong className="text-emerald-400 text-lg md:text-xl font-black font-mono">
                          {(() => {
                            const totalCorrect = pointLogs.reduce((sum, log) => sum + log.score, 0);
                            const totalQuestions = pointLogs.reduce((sum, log) => sum + log.totalQuestions, 0);
                            return totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
                          })()}%
                        </strong>
                      </div>
                    </div>

                    {/* Progress with Motivation message */}
                    {(() => {
                      const progressPercent = Math.min(100, Math.round((totalPoints / targetPoints) * 100));
                      let motivationMsg = "";
                      if (progressPercent >= 100) {
                        motivationMsg = "🎉 축하합니다! 최종 목표 포인트를 달성했어요! 보호자님께 약속된 멋진 보상을 당당하게 요청하세요! 🎁";
                      } else if (progressPercent >= 80) {
                        motivationMsg = `🎁 목표인 ${targetPoints} P까지 단 ${targetPoints - totalPoints} P 남았습니다! 마지막 골인이 바로 코앞이에요! 힘내세요! 🏃‍♂️`;
                      } else if (progressPercent >= 50) {
                        motivationMsg = "🔥 목표의 절반을 성공적으로 돌파했습니다! 이 기세를 이어 약속한 칭찬 보상까지 쭉 달려봅시다!";
                      } else if (progressPercent >= 20) {
                        motivationMsg = "🚀 든든하게 포인트가 누적되고 있습니다! 매일 조금씩 학습하고 퀴즈를 풀며 실력과 배지를 늘려가요!";
                      } else {
                        motivationMsg = "💪 첫 출발을 내딛었습니다! 매일 성실히 독서/공부하며 목표 포인트를 향해 화이팅하세요! 📚";
                      }

                      return (
                        <div className="bg-slate-800/30 border border-slate-800/60 p-5 rounded-3xl space-y-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 bg-sky-500/10 rounded-xl flex items-center justify-center shrink-0">
                              <span className="text-lg">🎯</span>
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-slate-200">목표 보상 성취도</h4>
                              <p className="text-[11px] text-slate-400">지정한 목표 점수 기준 획득 현황</p>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="flex justify-between text-xs font-semibold">
                              <span className="text-slate-300">목표 설정: {targetPoints} P</span>
                              <span className="text-sky-400 font-mono text-sm">{progressPercent}%</span>
                            </div>
                            <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800/50 p-[2px]">
                              <div 
                                className="h-full bg-gradient-to-r from-sky-400 via-indigo-400 to-sky-500 rounded-full transition-all duration-500 ease-out" 
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                            <p className="text-xs text-sky-400 bg-sky-500/10 border border-sky-500/20 p-3.5 rounded-2xl leading-relaxed font-semibold">
                              {motivationMsg}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* ─── TAB 2: Performance Charts (Pure SVG) ─── */}
                {pointModalTab === 'chart' && (
                  <div className="space-y-6">
                    {pointLogs.length === 0 ? (
                      <div className="text-center text-slate-500 py-16 bg-slate-800/10 border border-dashed border-slate-800 rounded-2xl">
                        분석에 필요한 퀴즈 결과 데이터가 부족합니다.<br/>
                        문제를 해결하고 포인트를 먼저 획득하세요!
                      </div>
                    ) : (
                      <>
                        {/* 1. Subject Bar Chart */}
                        <div className="bg-slate-800/30 border border-slate-800/60 p-5 rounded-3xl space-y-4">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">📚 과목별 획득 포인트 분포</h4>
                          {(() => {
                            const pointsBySubject = pointLogs.reduce((acc, log) => {
                              const sub = log.subject || '과목 없음';
                              acc[sub] = (acc[sub] || 0) + log.earnedPoints;
                              return acc;
                            }, {} as Record<string, number>);

                            const subjectData = Object.entries(pointsBySubject).map(([subject, points]) => ({ subject, points }));
                            const maxPoints = Math.max(...subjectData.map(d => d.points), 1);
                            const svgHeight = Math.max(120, subjectData.length * 40 + 20);

                            return (
                              <svg viewBox={`0 0 400 ${svgHeight}`} className="w-full h-auto text-slate-300">
                                <defs>
                                  <linearGradient id="subjectGrad" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#38bdf8" />
                                    <stop offset="100%" stopColor="#818cf8" />
                                  </linearGradient>
                                </defs>
                                {subjectData.map((d, i) => {
                                  const barWidth = (d.points / maxPoints) * 260;
                                  const y = i * 40 + 15;
                                  return (
                                    <g key={d.subject}>
                                      {/* Subject label */}
                                      <text x="5" y={y + 12} fill="#94a3b8" className="text-[10px] font-bold" textAnchor="start">
                                        {d.subject.slice(0, 7)}
                                      </text>
                                      {/* Background Bar */}
                                      <rect x="75" y={y} width="260" height="16" rx="8" fill="rgba(255,255,255,0.03)" />
                                      {/* Fill Bar */}
                                      <motion.rect 
                                        initial={{ width: 0 }}
                                        animate={{ width: barWidth }}
                                        transition={{ duration: 0.8, ease: 'easeOut' }}
                                        x="75" y={y} height="16" rx="8" fill="url(#subjectGrad)" 
                                      />
                                      {/* Points text */}
                                      <text x="345" y={y + 12} fill="#38bdf8" className="text-[10px] font-black font-mono" textAnchor="start">
                                        {d.points}P
                                      </text>
                                    </g>
                                  );
                                })}
                              </svg>
                            );
                          })()}
                        </div>

                        {/* 2. Cumulative Area Chart */}
                        <div className="bg-slate-800/30 border border-slate-800/60 p-5 rounded-3xl space-y-4">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">📈 최근 포인트 누적 성장 추이</h4>
                          {(() => {
                            const chronologicalLogs = [...pointLogs]
                              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                              .slice(-7);

                            let runningTotal = totalPoints - chronologicalLogs.reduce((sum, log) => sum + log.earnedPoints, 0);
                            const trendData = chronologicalLogs.map((log) => {
                              runningTotal += log.earnedPoints;
                              const dateObj = new Date(log.date);
                              return {
                                label: `${dateObj.getMonth() + 1}/${dateObj.getDate()}`,
                                points: runningTotal
                              };
                            });

                            const pointsList = trendData.map(d => d.points);
                            const minPoints = Math.min(...pointsList, 0);
                            const maxPoints = Math.max(...pointsList, 100);
                            const range = maxPoints - minPoints || 1;

                            const getCoords = (index: number, val: number) => {
                              const x = 45 + (index / (trendData.length - 1)) * 315;
                              const y = 145 - ((val - minPoints) / range) * 115;
                              return { x, y };
                            };

                            const pathCoords = trendData.map((d, i) => getCoords(i, d.points));
                            const pointsPath = pathCoords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
                            const areaPath = trendData.length > 0 
                              ? `${pointsPath} L ${pathCoords[pathCoords.length - 1].x} 145 L ${pathCoords[0].x} 145 Z` 
                              : '';

                            return (
                              <svg viewBox="0 0 400 180" className="w-full h-auto">
                                <defs>
                                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
                                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                                  </linearGradient>
                                </defs>
                                {/* Grid lines */}
                                <line x1="40" y1="145" x2="365" y2="145" stroke="#334155" strokeWidth="1" strokeDasharray="3" />
                                <line x1="40" y1="87" x2="365" y2="87" stroke="#334155" strokeWidth="0.5" strokeDasharray="3" />
                                <line x1="40" y1="30" x2="365" y2="30" stroke="#334155" strokeWidth="0.5" strokeDasharray="3" />

                                {trendData.length > 0 && (
                                  <>
                                    {/* Area */}
                                    <path d={areaPath} fill="url(#areaGrad)" />
                                    {/* Line */}
                                    <path d={pointsPath} fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                    
                                    {/* Dots and Labels */}
                                    {trendData.map((d, i) => {
                                      const { x, y } = getCoords(i, d.points);
                                      return (
                                        <g key={i}>
                                          <circle cx={x} cy={y} r="4.5" fill="#38bdf8" stroke="#0f172a" strokeWidth="2.5" />
                                          <text x={x} y={y - 8} textAnchor="middle" fill="#38bdf8" className="text-[9px] font-black font-mono">{d.points}P</text>
                                          <text x={x} y="160" textAnchor="middle" fill="#64748b" className="text-[9px] font-semibold">{d.label}</text>
                                        </g>
                                      );
                                    })}
                                  </>
                                )}
                              </svg>
                            );
                          })()}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* ─── TAB 3: Chronological Log History ─── */}
                {pointModalTab === 'logs' && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">📋 상세 포인트 적립 로그</h3>
                    
                    {pointLogs.length === 0 ? (
                      <div className="text-center text-slate-500 py-12 bg-slate-800/20 border border-dashed border-slate-800 rounded-2xl">
                        아직 적립된 포인트 내역이 없습니다.<br/>
                        첫 퀴즈를 풀고 포인트를 모아보세요! 🚀
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[48vh] overflow-y-auto pr-1 custom-scrollbar">
                        {pointLogs.map((log) => {
                          const dateObj = new Date(log.date);
                          const dateFormatted = `${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일 ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
                          
                          return (
                            <div 
                              key={log.id} 
                              className="p-3.5 bg-slate-800/40 border border-slate-800 hover:border-slate-700/60 rounded-xl flex items-center justify-between gap-3 transition-colors"
                            >
                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="px-1.5 py-0.5 bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[10px] font-bold rounded">
                                    {log.subject || '과목 없음'}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    {dateFormatted}
                                  </span>
                                </div>
                                <h4 className="text-white font-bold text-sm truncate" title={log.quizTitle}>
                                  {log.quizTitle}
                                </h4>
                                <p className="text-[11px] text-slate-400">
                                  성적: <strong className="text-slate-300">{log.score}</strong> / {log.totalQuestions} 문제 맞힘 ({Math.round((log.score / log.totalQuestions) * 100)}점)
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                {log.earnedPoints > 0 ? (
                                  <span className="text-emerald-400 font-black font-mono text-base bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg">
                                    +{log.earnedPoints} P
                                  </span>
                                ) : (
                                  <span className="text-slate-500 font-black font-mono text-xs bg-slate-800/80 border border-slate-700/50 px-2 py-1 rounded-lg">
                                    0 P (미통과)
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

              </div>
              
              {/* Footer */}
              <div className="mt-4 pt-4 border-t border-slate-800 text-center shrink-0">
                <button 
                  onClick={() => setShowPointAnalysis(false)}
                  className="w-full py-3.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-2xl transition-colors shadow-lg shadow-sky-500/20 text-sm"
                >
                  확인 및 닫기
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* History Modal */}
        {showHistory && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <div className="bg-slate-900/90 backdrop-blur-2xl p-8 rounded-[32px] border border-slate-700 w-full max-w-2xl shadow-2xl relative max-h-[80vh] flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Book className="text-sky-400" /> 내 학습 기록
                </h2>
                <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400">
                   <X size={24} />
                </button>
              </div>
              <div className="flex flex-col md:flex-row gap-4 mb-4 items-end bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50">
                 <div className="flex-1 w-full">
                    <label className="text-xs text-slate-400 mb-1 block">분류 모아보기 (과목)</label>
                    <select 
                       value={historyFilterSubject}
                       onChange={(e) => setHistoryFilterSubject(e.target.value)}
                       className="w-full bg-slate-800 focus:ring-2 focus:ring-sky-500 text-sm text-slate-200 p-2 rounded-xl border border-slate-700"
                    >
                       <option value="all">전체 기록 보기</option>
                       {Array.from(new Set(historyList.map(h => (h.subject && h.subject.trim() !== '') ? h.subject : '과목 없음'))).map(sub => (
                          <option key={sub} value={sub}>{sub}</option>
                       ))}
                    </select>
                 </div>
                 <div className="w-full md:w-auto min-w-[120px]">
                    <label className="text-xs text-slate-400 mb-1 block">정렬 순서</label>
                    <select 
                       value={historySortOrder}
                       onChange={(e) => setHistorySortOrder(e.target.value as 'desc' | 'asc')}
                       className="w-full bg-slate-800 focus:ring-2 focus:ring-sky-500 text-sm text-slate-200 p-2 rounded-xl border border-slate-700"
                    >
                       <option value="desc">최신 순</option>
                       <option value="asc">오래된 순</option>
                    </select>
                 </div>
              </div>

              <div className="overflow-y-auto custom-scrollbar flex-1 pr-2 space-y-4">
                {(() => {
                  const filtered = historyList
                    .map(h => ({ ...h, displaySub: (h.subject && h.subject.trim() !== '') ? h.subject : '과목 없음' }))
                    .filter(h => historyFilterSubject === 'all' || h.displaySub === historyFilterSubject)
                    .sort((a, b) => historySortOrder === 'desc' 
                        ? new Date(b.date).getTime() - new Date(a.date).getTime() 
                        : new Date(a.date).getTime() - new Date(b.date).getTime());
                  
                  if (filtered.length === 0) {
                    return <div className="text-center text-slate-500 py-12">학습 기록이 없습니다.</div>;
                  }
                  return filtered.map(item => (
                    <div key={item.id} className="p-4 bg-slate-800/50 border border-slate-700 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-slate-500 transition-colors">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          {editingSubjectId === item.id ? (
                            <div className="flex items-center gap-1 bg-slate-900 border border-sky-500 rounded p-1">
                               <input 
                                 type="text" 
                                 value={editingSubjectText}
                                 onChange={(e) => setEditingSubjectText(e.target.value)}
                                 className="w-24 px-1 py-0.5 bg-transparent focus:outline-none text-xs text-white"
                                 autoFocus
                                 placeholder="과목명"
                                 onKeyDown={async (e) => {
                                    if(e.key==='Enter') {
                                       const updated = {...historyList.find(h=>h.id===item.id)!, subject: editingSubjectText || '과목 없음'};
                                       await saveQuizHistory(updated);
                                       setHistoryList(prev => prev.map(h => h.id === item.id ? updated : h));
                                       setEditingSubjectId(null);
                                    } else if (e.key==='Escape') {
                                       setEditingSubjectId(null);
                                    }
                                 }}
                               />
                               <button onClick={async () => {
                                       const updated = {...historyList.find(h=>h.id===item.id)!, subject: editingSubjectText || '과목 없음'};
                                       await saveQuizHistory(updated);
                                       setHistoryList(prev => prev.map(h => h.id === item.id ? updated : h));
                                       setEditingSubjectId(null);
                               }} className="text-xs px-2 text-sky-400 font-bold">확인</button>
                            </div>
                          ) : (
                            <span 
                              className="px-2 py-1 bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-bold rounded-lg cursor-pointer hover:bg-sky-500/20"
                              onClick={() => { setEditingSubjectId(item.id); setEditingSubjectText(item.displaySub === '과목 없음' ? '' : item.displaySub); }}
                              title="과목을 수정하려면 클릭하세요"
                            >
                              {item.displaySub} <span className="opacity-50">✏️</span>
                            </span>
                          )}
                          <span className="text-xs text-slate-500">{new Date(item.date).toLocaleDateString()}</span>
                        </div>
                        <h3 className="text-white font-bold">{item.title}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-sm text-slate-400">총 {item.totalQuestions}문제</p>
                          {item.isFinalized && (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${item.score && item.totalQuestions && (item.score / item.totalQuestions >= passThreshold / 100) ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                              {item.score}점 {item.pointsEarned ? `(+${item.pointsEarned}P)` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                           setQuizResult(item.quizResult);
                           setWrongQuestions(new Set(item.wrongQuestions || []));
                           setStep(3);
                           setSubject(item.displaySub);
                           setShowHistory(false);
                           setCurrentQuizId(item.id);
                           setIsQuizFinalized(!!item.isFinalized);
                           if (item.difficulty) setDifficulty(item.difficulty);
                        }}
                        className="px-4 py-2 bg-sky-500 text-white text-sm font-bold rounded-xl shadow-lg hover:bg-sky-400 transition-colors"
                      >
                        결과 다시보기
                      </button>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </motion.div>
        )}

        {/* Settings Modal */}
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <div className="bg-slate-900/90 backdrop-blur-2xl p-6 md:p-8 rounded-[32px] border border-slate-700 w-full max-w-md shadow-2xl relative">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Settings className="text-sky-400" /> 설정
                </h2>
                <button onClick={() => { setShowSettings(false); setIsAdminUnlocked(false); }} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400">
                  <X size={24} />
                </button>
              </div>

              {/* Settings Tab Selector */}
              <div className="flex bg-slate-800/50 p-1 rounded-xl mb-6 border border-slate-700/50">
                <button 
                  onClick={() => setSettingsTab('general')}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${settingsTab === 'general' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  <Settings size={14} /> 일반
                </button>
                <button 
                  onClick={handleAdminAccess}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${settingsTab === 'admin' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  <Lock size={14} /> 관리자 (보호자)
                </button>
              </div>

              <div className="space-y-6 overflow-y-auto custom-scrollbar pr-2" style={{ maxHeight: 'calc(80vh - 180px)' }}>
                
                {/* ─── General Settings Tab ─── */}
                {settingsTab === 'general' && (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm text-slate-300 flex items-center gap-1.5 font-semibold">
                          객관식 재도전 기회 {lockRetry && <Lock size={12} className="text-amber-400 shrink-0" />}
                        </span>
                        <span className="text-xs text-slate-500 mt-0.5">
                          {lockRetry ? "🔒 보호자 설정에 의해 변경이 금지되었습니다." : "오답 시 한 번 더 풀 수 있음 (포인트 50%)"}
                        </span>
                      </div>
                      <button 
                        onClick={() => { if (!lockRetry) setRetryMultipleChoice(!retryMultipleChoice); }}
                        disabled={lockRetry}
                        className={`w-12 h-6 rounded-full transition-colors relative ${retryMultipleChoice ? 'bg-sky-500' : 'bg-slate-700'} ${lockRetry ? 'opacity-40 cursor-not-allowed' : 'hover:bg-opacity-80'}`}
                      >
                        <motion.div 
                          animate={{ x: retryMultipleChoice ? 24 : 2 }}
                          className="w-5 h-5 bg-white rounded-full absolute top-[2px]"
                        />
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm text-slate-300 flex items-center gap-1.5 font-semibold">
                          문제 글자 크기 {lockFontSize && <Lock size={12} className="text-amber-400 shrink-0" />}
                        </span>
                        {lockFontSize && <span className="text-[10px] text-slate-500 mt-0.5">🔒 보호자 설정에 의해 고정됨</span>}
                      </div>
                      <select 
                        value={quizFontSize}
                        disabled={lockFontSize}
                        onChange={(e) => setQuizFontSize(e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm focus:outline-none text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <option value="small">작게</option>
                        <option value="medium">보통</option>
                        <option value="large">크게</option>
                      </select>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm text-slate-300 flex items-center gap-1.5 font-semibold">
                          원문 근거 노출 방식 {lockContextTiming && <Lock size={12} className="text-amber-400 shrink-0" />}
                        </span>
                        {lockContextTiming && <span className="text-[10px] text-slate-500 mt-0.5">🔒 보호자 설정에 의해 고정됨</span>}
                      </div>
                      <select 
                        value={showContextTiming}
                        disabled={lockContextTiming}
                        onChange={(e) => setShowContextTiming(e.target.value as 'always' | 'after_quiz')}
                        className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm focus:outline-none text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <option value="always">항상 보기</option>
                        <option value="after_quiz">다 풀고 나서 보기</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm text-slate-300 font-semibold">
                          화면 스킨 테마
                        </span>
                        <span className="text-xs text-slate-500 mt-0.5">
                          어플리케이션 색상 테마 설정
                        </span>
                      </div>
                      <select 
                        value={theme}
                        onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
                        className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm focus:outline-none text-slate-300"
                      >
                        <option value="system">🌓 시스템 설정</option>
                        <option value="light">☀️ 밝은 톤</option>
                        <option value="dark">🌙 어두운 톤</option>
                      </select>
                    </div>

                    <div className="pt-4 border-t border-slate-800">
                      <p className="text-xs text-slate-500 text-center">
                        🔒 API 키, 포인트, 통과 기준은 <button onClick={handleAdminAccess} className="text-sky-400 font-bold">관리자(보호자) 탭</button>에서 변경할 수 있습니다.
                      </p>
                    </div>
                  </>
                )}

                {/* ─── Admin Settings Tab ─── */}
                {settingsTab === 'admin' && (
                  <>
                    {/* Password Setup Modal */}
                    {showPasswordSetup && (
                      <div className="bg-slate-800 rounded-2xl p-6 border border-sky-500/30 space-y-4">
                        <div className="flex items-center gap-2 text-sky-400 font-bold">
                          <ShieldCheck size={20} />
                          <span>보호자 비밀번호 설정</span>
                        </div>
                        <p className="text-xs text-slate-400">학생이 포인트나 보상 설정을 변경하지 못하도록 비밀번호를 설정합니다.</p>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="비밀번호 (4자 이상)"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
                        />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="비밀번호 확인"
                          value={newPasswordConfirm}
                          onChange={(e) => setNewPasswordConfirm(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSetPassword(); }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
                        />
                        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                          <input type="checkbox" checked={showPassword} onChange={() => setShowPassword(!showPassword)} className="rounded" />
                          비밀번호 보기
                        </label>
                        {passwordError && <p className="text-rose-400 text-xs">{passwordError}</p>}
                        <button onClick={handleSetPassword} className="w-full btn-premium py-3 rounded-xl font-bold">설정 완료</button>
                      </div>
                    )}

                    {/* Password Prompt */}
                    {showPasswordPrompt && (
                      <div className="bg-slate-800 rounded-2xl p-6 border border-amber-500/30 space-y-4">
                        <div className="flex items-center gap-2 text-amber-400 font-bold">
                          <Lock size={20} />
                          <span>비밀번호를 입력하세요</span>
                        </div>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="보호자 비밀번호"
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleVerifyPassword(); }}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 px-4 pr-12 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                            autoFocus
                          />
                          <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                        {passwordError && <p className="text-rose-400 text-xs">{passwordError}</p>}
                        <div className="flex gap-2">
                          <button onClick={handleVerifyPassword} className="flex-1 btn-premium py-3 rounded-xl font-bold">확인</button>
                          <button onClick={() => { setShowPasswordPrompt(false); setPasswordError(''); setSettingsTab('general'); }} className="flex-1 bg-slate-700 py-3 rounded-xl font-bold text-slate-300 hover:bg-slate-600">취소</button>
                        </div>
                        <div className="pt-3 border-t border-slate-700">
                          <button 
                            onClick={handleFactoryReset}
                            className="w-full flex items-center justify-center gap-2 text-rose-400 text-xs hover:text-rose-300 py-2"
                          >
                            <AlertTriangle size={14} /> 비밀번호를 잊으셨나요? (전체 초기화)
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Unlocked Admin Content */}
                    {isAdminUnlocked && !showPasswordSetup && !showPasswordPrompt && (
                      <>
                        <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold mb-2">
                          <ShieldCheck size={16} /> 관리자 모드 (잠금 해제됨)
                        </div>

                        {/* Provider Sub-Tabs */}
                        <div className="space-y-4">
                          <label className="block text-sm font-medium text-slate-400">AI 서비스 공급자 선택</label>
                          <div className="grid grid-cols-3 gap-2 bg-slate-950/60 p-1.5 rounded-2xl border border-slate-800">
                            <button
                              type="button"
                              onClick={() => setActiveProvider('gemini')}
                              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                                activeProvider === 'gemini'
                                  ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-lg shadow-sky-500/20'
                                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                              }`}
                            >
                              🚀 Gemini
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveProvider('openai')}
                              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                                activeProvider === 'openai'
                                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20'
                                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                              }`}
                            >
                              🟢 OpenAI
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveProvider('claude')}
                              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                                activeProvider === 'claude'
                                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20'
                                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                              }`}
                            >
                              🔥 Claude
                            </button>
                          </div>
                        </div>

                        {/* Provider Configuration */}
                        <div className="space-y-4 pt-2">
                          {/* API Key Header & Guide Toggle */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-slate-400">
                                  {activeProvider === 'gemini' ? 'Gemini API Key' : activeProvider === 'openai' ? 'OpenAI API Key' : 'Claude API Key'}
                                </label>
                                <button 
                                  type="button"
                                  onClick={() => setShowApiHelp(!showApiHelp)}
                                  className={`transition-colors focus:outline-none ${showApiHelp ? 'text-sky-400' : 'text-slate-500 hover:text-sky-400'}`}
                                >
                                  <HelpCircle size={16} />
                                </button>
                              </div>
                            </div>

                            {/* Aligned Key Input and Look Up in Sub-panel */}
                            <div className="relative">
                              <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                              {activeProvider === 'gemini' && (
                                <input 
                                  type="password"
                                  value={apiKeyGemini}
                                  onChange={(e) => setApiKeyGemini(e.target.value)}
                                  placeholder="Google Gemini API 키 입력"
                                  className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all font-mono text-sm text-slate-200"
                                />
                              )}
                              {activeProvider === 'openai' && (
                                <input 
                                  type="password"
                                  value={apiKeyOpenai}
                                  onChange={(e) => setApiKeyOpenai(e.target.value)}
                                  placeholder="OpenAI API 키 입력 (sk-...)"
                                  className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-mono text-sm text-slate-200"
                                />
                              )}
                              {activeProvider === 'claude' && (
                                <input 
                                  type="password"
                                  value={apiKeyClaude}
                                  onChange={(e) => setApiKeyClaude(e.target.value)}
                                  placeholder="Anthropic Claude API 키 입력"
                                  className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all font-mono text-sm text-slate-200"
                                />
                              )}
                            </div>

                            {/* 저장 및 모델조회 버튼을 아래쪽에 배치 */}
                            <div className="mt-2.5">
                              <button
                                type="button"
                                onClick={async () => {
                                  saveAllSettings();
                                  await handleDiscoverModels();
                                }}
                                disabled={isDiscovering}
                                className="w-full py-2.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                              >
                                <RotateCcw size={13} className={isDiscovering ? 'animate-spin' : ''} /> 저장 및 모델조회
                              </button>
                            </div>
                          </div>

                          {/* Dynamic Guide per activeProvider */}
                          <AnimatePresence>
                            {showApiHelp && (
                              <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="bg-slate-800 border border-sky-500/30 text-slate-300 text-sm rounded-xl p-4 mb-2 shadow-lg space-y-3">
                                  {activeProvider === 'gemini' && (
                                    <>
                                      <p className="font-bold text-sky-400 border-b border-slate-700 pb-2 flex items-center gap-1.5">
                                        <span>🔑 Gemini API 키 무료 발급 가이드</span>
                                        <span className="bg-emerald-500/20 text-emerald-400 text-[9px] px-1.5 py-0.5 rounded font-normal">강력추천! 무료</span>
                                      </p>
                                      <div className="space-y-2.5 text-xs text-slate-300">
                                        <p>Gemini API 키는 구글 계정만 있다면 <strong>완전 무료</strong>로 1분 만에 만들 수 있어요!</p>
                                        <div className="flex gap-2 items-start bg-slate-900/40 p-2.5 rounded-lg border border-slate-700/50">
                                          <span className="w-5 h-5 bg-sky-500/20 text-sky-400 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                                          <p>
                                            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-sky-400 hover:underline font-bold inline-flex items-center gap-1">
                                              👉 여기를 클릭해 구글 AI Studio로 가기
                                            </a>
                                          </p>
                                        </div>
                                        <div className="flex gap-2 items-start bg-slate-900/40 p-2.5 rounded-lg border border-slate-700/50">
                                          <span className="w-5 h-5 bg-sky-500/20 text-sky-400 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                                          <p>구글 로그인 후 화면 상단의 파란색 <strong className="text-white">&quot;Create API key&quot;</strong> 버튼을 클릭하세요.</p>
                                        </div>
                                        <div className="flex gap-2 items-start bg-slate-900/40 p-2.5 rounded-lg border border-slate-700/50">
                                          <span className="w-5 h-5 bg-sky-500/20 text-sky-400 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                                          <p><strong className="text-white">&quot;Create API key in new project&quot;</strong>를 누르고 생성된 영어+숫자 키를 복사해서 붙여넣으세요!</p>
                                        </div>
                                      </div>
                                    </>
                                  )}
                                  {activeProvider === 'openai' && (
                                    <>
                                      <p className="font-bold text-emerald-400 border-b border-slate-700 pb-2">🔑 OpenAI API 키 발급 가이드</p>
                                      <div className="space-y-2.5 text-xs text-slate-300">
                                        <p>OpenAI API 키를 발급받으려면 결제용 크레딧(최소 $5) 충전이 필요합니다.</p>
                                        <div className="flex gap-2 items-start bg-slate-900/40 p-2.5 rounded-lg border border-slate-700/50">
                                          <span className="w-5 h-5 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                                          <p>
                                            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline font-bold">
                                              👉 OpenAI Developer Platform 바로가기
                                            </a>
                                          </p>
                                        </div>
                                        <div className="flex gap-2 items-start bg-slate-900/40 p-2.5 rounded-lg border border-slate-700/50">
                                          <span className="w-5 h-5 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                                          <p>로그인 후 <strong className="text-white">&quot;+ Create new secret key&quot;</strong> 버튼을 눌러 키를 생성하고 복사하세요.</p>
                                        </div>
                                      </div>
                                    </>
                                  )}
                                  {activeProvider === 'claude' && (
                                    <>
                                      <p className="font-bold text-amber-400 border-b border-slate-700 pb-2">🔑 Anthropic Claude API 키 발급 가이드</p>
                                      <div className="space-y-2.5 text-xs text-slate-300">
                                        <p className="text-amber-400/90 bg-amber-500/10 p-2 rounded border border-amber-500/20 text-[11px] leading-relaxed">
                                          ⚠️ <strong>주의 (CORS 제한):</strong> Anthropic API는 브라우저 직접 호출 시 보안(CORS) 제한이 엄격합니다. 로컬 테스트 및 특수 웹 뷰 환경에서만 원활히 작동합니다.
                                        </p>
                                        <div className="flex gap-2 items-start bg-slate-900/40 p-2.5 rounded-lg border border-slate-700/50">
                                          <span className="w-5 h-5 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                                          <p>
                                            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="text-amber-400 hover:underline font-bold">
                                              👉 Anthropic Console 바로가기
                                            </a>
                                          </p>
                                        </div>
                                        <div className="flex gap-2 items-start bg-slate-900/40 p-2.5 rounded-lg border border-slate-700/50">
                                          <span className="w-5 h-5 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                                          <p>로그인 후 <strong className="text-white">&quot;Create Key&quot;</strong> 버튼을 눌러 키를 생성하고 복사하세요.</p>
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Model Selection */}
                          <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">AI 모델 선택</label>
                            {activeProvider === 'gemini' && (
                              <select 
                                value={modelGemini}
                                onChange={(e) => setModelGemini(e.target.value)}
                                className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all text-slate-200 text-sm font-mono"
                              >
                                <option value="gemini-flash-latest">🌟 추천: Gemini Flash Latest (초고속 및 최고 효율)</option>
                                <option value="gemini-3.5-flash">🌟 추천: Gemini 3.5 Flash (최신 세대 고성능)</option>
                                <option value="gemini-1.5-pro">Gemini 1.5 Pro (느리지만 높은 문제 완성도)</option>
                                {discoveredGemini.filter(m => m !== 'gemini-flash-latest' && m !== 'gemini-3.5-flash' && m !== 'gemini-1.5-pro').map(m => (
                                  <option key={m} value={m}>{m}</option>
                                ))}
                              </select>
                            )}
                            {activeProvider === 'openai' && (
                              <select 
                                value={modelOpenai}
                                onChange={(e) => setModelOpenai(e.target.value)}
                                className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-slate-200 text-sm font-mono"
                              >
                                <option value="gpt-4o-mini">🌟 추천: GPT-4o Mini (빠르고 매우 똑똑함)</option>
                                <option value="gpt-4o">GPT-4o (강력한 추론 능력)</option>
                                <option value="o1-mini">o1-mini (추론 특화 / 수학 과학 우수)</option>
                                {discoveredOpenai.filter(m => m !== 'gpt-4o-mini' && m !== 'gpt-4o' && m !== 'o1-mini').map(m => (
                                  <option key={m} value={m}>{m}</option>
                                ))}
                              </select>
                            )}
                            {activeProvider === 'claude' && (
                              <select 
                                value={modelClaude}
                                onChange={(e) => setModelClaude(e.target.value)}
                                className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all text-slate-200 text-sm font-mono"
                              >
                                <option value="claude-3-5-sonnet-latest">🌟 추천: Claude 3.5 Sonnet (최상의 어휘력과 국어 퀴즈)</option>
                                <option value="claude-3-5-haiku-latest">Claude 3.5 Haiku (빠른 속도)</option>
                                {discoveredClaude.filter(m => m !== 'claude-3-5-sonnet-latest' && m !== 'claude-3-5-haiku-latest').map(m => (
                                  <option key={m} value={m}>{m}</option>
                                ))}
                              </select>
                            )}

                            {/* 연결 테스트 버튼을 모델 선택 바로 아래에 배치 */}
                            <div className="mt-2.5">
                              <button 
                                type="button"
                                onClick={handleTestConnection}
                                disabled={!apiKey || isTesting}
                                className="w-full py-2.5 bg-slate-800 border border-slate-700 rounded-2xl font-bold hover:bg-slate-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-xs text-slate-300"
                              >
                                {isTesting ? '연결 확인 중...' : '🔌 연결 테스트'}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Point Settings */}
                        <div className="pt-4 border-t border-slate-800 space-y-4">
                          <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">🏆 포인트 및 보상 설정</h3>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="text-sm text-slate-300">통과 기준 (정답률 %)</span>
                              <span className="text-xs text-slate-500">이 이상 맞춰야 포인트를 받아요</span>
                            </div>
                            <input 
                              type="number" 
                              value={passThreshold} 
                              onChange={(e) => setPassThreshold(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                              className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm focus:outline-none text-slate-300 w-16 text-center"
                            />
                          </div>
                          
                          {/* Per-type point config */}
                          <div className="space-y-3">
                            <p className="text-xs text-slate-400">유형별 획득 포인트 (정답 1개당)</p>
                            {([
                              { key: 'MULTIPLE_CHOICE' as const, label: '객관식', note: '2번째 정답 시 50%' },
                              { key: 'SHORT_ANSWER' as const, label: '단답형', note: '' },
                              { key: 'ESSAY' as const, label: '서술형', note: '' },
                              { key: 'CSAT' as const, label: '수능형', note: '' },
                            ]).map(t => (
                              <div key={t.key} className="flex items-center justify-between bg-slate-800/30 px-3 py-2 rounded-xl border border-slate-700/30">
                                <div>
                                  <span className="text-sm text-slate-300">{t.label}</span>
                                  {t.note && <span className="text-[10px] text-amber-400/70 ml-2">({t.note})</span>}
                                </div>
                                <div className="flex items-center gap-1">
                                  <input 
                                    type="number" 
                                    value={pointConfig[t.key]} 
                                    onChange={(e) => setPointConfig(prev => ({ ...prev, [t.key]: Math.max(0, parseInt(e.target.value) || 0) }))}
                                    className="bg-slate-800 border border-slate-700 rounded-lg p-1.5 text-sm focus:outline-none text-slate-300 w-14 text-center"
                                  />
                                  <span className="text-xs text-slate-500">P</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="text-sm text-slate-300 font-semibold">목표 보상 포인트</span>
                              <span className="text-xs text-slate-500 mt-0.5">학생의 달성 목표 포인트 점수</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <input 
                                type="number" 
                                value={targetPoints} 
                                onChange={(e) => setTargetPoints(Math.max(1, parseInt(e.target.value) || 1))}
                                className="bg-slate-800 border border-slate-700 rounded-lg p-1.5 text-sm focus:outline-none text-slate-300 w-20 text-center font-bold font-mono text-sky-400"
                              />
                              <span className="text-xs text-slate-500 font-bold">P</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="text-sm text-slate-300 font-semibold">매월 포인트 자동 리셋</span>
                            </div>
                            <button 
                              onClick={() => setAutoResetPoints(!autoResetPoints)}
                              className={`w-12 h-6 rounded-full transition-colors relative ${autoResetPoints ? 'bg-sky-500' : 'bg-slate-700'}`}
                            >
                              <motion.div 
                                animate={{ x: autoResetPoints ? 24 : 2 }}
                                className="w-5 h-5 bg-white rounded-full absolute top-[2px]"
                              />
                            </button>
                          </div>
                          
                          <div className="flex items-center justify-between pt-2">
                             <span className="text-sm text-slate-300">현재 누적 포인트: <strong className="text-sky-400">{totalPoints} P</strong></span>
                             <button 
                               onClick={() => {
                                 if(confirm('정말 포인트를 초기화 하시겠습니까?')) {
                                   setTotalPoints(0);
                                 }
                                }}
                               className="px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs"
                             >
                               수동 초기화
                             </button>
                          </div>
                        </div>

                        {/* Guardian Locking Controls */}
                        <div className="pt-4 border-t border-slate-800 space-y-4">
                          <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                            <span>🔒 학생용 일반 설정 고정 (잠금)</span>
                          </h3>
                          
                          <div className="flex items-center justify-between bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800">
                            <div className="flex flex-col">
                              <span className="text-sm text-slate-300 font-semibold">객관식 재도전 기회 고정</span>
                              <span className="text-xs text-slate-500 mt-0.5">일반 설정에서 변경 금지</span>
                            </div>
                            <button 
                              onClick={() => setLockRetry(!lockRetry)}
                              className={`w-12 h-6 rounded-full transition-colors relative ${lockRetry ? 'bg-amber-500' : 'bg-slate-700'}`}
                            >
                              <motion.div 
                                animate={{ x: lockRetry ? 24 : 2 }}
                                className="w-5 h-5 bg-white rounded-full absolute top-[2px]"
                              />
                            </button>
                          </div>

                          <div className="flex items-center justify-between bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800">
                            <div className="flex flex-col">
                              <span className="text-sm text-slate-300 font-semibold">문제 글자 크기 고정</span>
                              <span className="text-xs text-slate-500 mt-0.5">일반 설정에서 변경 금지</span>
                            </div>
                            <button 
                              onClick={() => setLockFontSize(!lockFontSize)}
                              className={`w-12 h-6 rounded-full transition-colors relative ${lockFontSize ? 'bg-amber-500' : 'bg-slate-700'}`}
                            >
                              <motion.div 
                                animate={{ x: lockFontSize ? 24 : 2 }}
                                className="w-5 h-5 bg-white rounded-full absolute top-[2px]"
                              />
                            </button>
                          </div>

                          <div className="flex items-center justify-between bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800">
                            <div className="flex flex-col">
                              <span className="text-sm text-slate-300 font-semibold">원문 근거 노출 잠금</span>
                              <span className="text-xs text-slate-500 mt-0.5">일반 설정에서 변경 금지</span>
                            </div>
                            <button 
                              onClick={() => setLockContextTiming(!lockContextTiming)}
                              className={`w-12 h-6 rounded-full transition-colors relative ${lockContextTiming ? 'bg-amber-500' : 'bg-slate-700'}`}
                            >
                              <motion.div 
                                animate={{ x: lockContextTiming ? 24 : 2 }}
                                className="w-5 h-5 bg-white rounded-full absolute top-[2px]"
                              />
                            </button>
                          </div>
                        </div>

                        {/* Password change / Factory reset */}
                        <div className="pt-4 border-t border-slate-800 space-y-3">
                          <button
                            onClick={() => { setShowPasswordSetup(true); setShowPasswordPrompt(false); }}
                            className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl text-sm font-bold transition-colors border border-slate-700"
                          >
                            <Lock size={16} /> 비밀번호 변경
                          </button>
                          <button
                            onClick={handleFactoryReset}
                            className="w-full flex items-center justify-center gap-2 text-rose-400 hover:text-rose-300 py-2 text-xs"
                          >
                            <Trash2 size={14} /> 전체 초기화 (모든 데이터 삭제)
                          </button>
                        </div>

                        <div className="pt-2">
                          <button 
                            onClick={() => {
                              saveAllSettings();
                              setShowSettings(false);
                              setIsAdminUnlocked(false);
                            }}
                            className="w-full py-3.5 bg-sky-500 rounded-2xl text-white font-bold hover:bg-sky-600 shadow-lg shadow-sky-500/30 transition-all text-sm"
                          >
                            저장 및 닫기
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
        {showCamera && (
          <CameraPreview 
            onCapture={(capturedFiles) => setFiles(prev => [...prev, ...capturedFiles.map(f => ({ file: f }))])} 
            onClose={() => setShowCamera(false)} 
          />
        )}
      </AnimatePresence>

      {/* ── Hero Section ── */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl w-full text-center space-y-6 mt-12 px-4"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 glass rounded-full text-sm text-sky-400 mb-4">
          <BrainCircuit size={16} />
          <span className="font-bold tracking-widest uppercase">LALA QUIZ</span>
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
          어떤 문서든 <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400">
            즉시 퀴즈로
          </span>
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          파일을 올리기만 하면 AI가 핵심을 파악하여 맞춤형 문제를 생성합니다.
        </p>
      </motion.div>

      {/* ── Upload Zone ── */}
      <div className="w-full max-w-2xl mt-12 space-y-8 px-4">
        {/* Upload Mode Selector */}
        <div className="flex glass p-1 rounded-2xl self-center mx-auto w-fit">
          <button 
            onClick={() => setUploadMode('file')}
            className={`flex items-center gap-2 px-6 py-2 rounded-xl transition-all ${uploadMode === 'file' ? 'bg-sky-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            <FileText size={18} /> 파일 업로드
          </button>
          <button 
            onClick={() => setUploadMode('camera')}
            className={`flex items-center gap-2 px-6 py-2 rounded-xl transition-all ${uploadMode === 'camera' ? 'bg-sky-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            <Camera size={18} /> 카메라 촬영
          </button>
        </div>

        {/* Dynamic Upload Zone */}
        <div className="glass p-8 md:p-12 rounded-[40px] space-y-6 text-center border-2 border-slate-800/50">
          <AnimatePresence mode="wait">
            <motion.div
              key={uploadMode}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex flex-col items-center"
            >
              <div 
                onClick={() => {
                  if (uploadMode === 'camera') {
                    setShowCamera(true);
                  }
                }}
                className="w-full"
              >
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700/50 rounded-3xl p-8 md:p-12 w-full hover:bg-white/5 transition-all group cursor-pointer">
                  <div className="text-slate-600 group-hover:text-sky-400 transition-colors">
                    {uploadMode === 'file' ? <Upload size={64} /> : <Camera size={64} />}
                  </div>
                  <div className="mt-6 space-y-2">
                    <span className="text-xl font-semibold text-slate-200">
                      {files.length > 0 ? `${files.length}개의 파일 선택됨` : (uploadMode === 'file' ? '문서 파일을 선택하세요' : '교재를 촬영하세요')}
                    </span>
                    <p className="text-sm text-slate-500">
                      {uploadMode === 'file' ? 'PDF, PNG, JPG (최대 20페이지)' : '카메라로 즉시 촬영하여 분석합니다'}
                    </p>
                    {files.length > 0 && (
                      <div className="flex flex-col gap-3 mt-4 w-full">
                        {files.map((f, i) => (
                          <div key={i} className="px-4 py-3 bg-slate-900/50 rounded-xl text-sm border border-slate-700 flex flex-wrap items-center gap-3 justify-between">
                             <div className="flex items-center gap-2 text-slate-300">
                               <FileText size={14} className="text-sky-400" />
                               {f.file.name.slice(0, 20)}{f.file.name.length > 20 ? '...' : ''}
                             </div>
                             
                             {f.file.type === 'application/pdf' && (
                               <div className="flex gap-2 items-center text-xs">
                                  <span className="text-slate-500">페이지:</span>
                                  <input 
                                    type="number" 
                                    placeholder="시작" 
                                    value={f.startPage || ''} 
                                    onChange={(e) => {
                                      const newFiles = [...files];
                                      newFiles[i].startPage = e.target.value ? parseInt(e.target.value) : undefined;
                                      setFiles(newFiles);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-14 bg-slate-800 text-center border-slate-600 rounded px-1 py-1" 
                                  />
                                  <span>-</span>
                                  <input 
                                    type="number" 
                                    placeholder="끝" 
                                    value={f.endPage || ''} 
                                    onChange={(e) => {
                                      const newFiles = [...files];
                                      newFiles[i].endPage = e.target.value ? parseInt(e.target.value) : undefined;
                                      setFiles(newFiles);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-14 bg-slate-800 text-center border-slate-600 rounded px-1 py-1" 
                                  />
                               </div>
                             )}

                             <button 
                              className="text-red-400 p-1 hover:bg-red-400/20 rounded ml-auto flex-shrink-0" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setFiles(prev => prev.filter((_, idx) => idx !== i));
                              }}
                             >
                                <X size={16} />
                             </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {uploadMode === 'file' && (
                    <input 
                      type="file" 
                      multiple
                      accept="application/pdf,image/*"
                      className="hidden" 
                      onChange={(e) => {
                        const newFiles = Array.from(e.target.files || []).map(file => ({ file, startPage: 1, endPage: undefined }));
                        setFiles(prev => [...prev, ...newFiles]);
                      }}
                    />
                  )}
                </label>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Quiz Configuration ── */}
      <div className="w-full max-w-2xl mt-8 px-4">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass p-6 md:p-8 rounded-3xl space-y-8"
        >
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1 space-y-4">
              <div className="pb-4 border-b border-slate-800">
                 <label className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-2">
                   과목 지정
                 </label>
                 <input 
                   type="text"
                   value={subject}
                   onChange={(e) => setSubject(e.target.value)}
                   placeholder="예) 국어, 수학, 사회..."
                   className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-sky-500/50 text-sm placeholder:text-slate-500"
                 />
              </div>

              <div className="flex justify-between items-center pt-2">
                <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  문제 수: <span className="text-sky-400 text-xl">{numQuestions}</span>
                </label>
              </div>
              <input 
                type="range"
                min="1"
                max="20"
                step="1"
                value={numQuestions}
                onChange={(e) => setNumQuestions(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>1</span>
                <span>10</span>
                <span>20</span>
              </div>
              
              <div className="pt-4">
                <label className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-3">
                  문제 난이도
                </label>
                <div className="flex gap-2">
                  {['쉬움', '보통', '어려움'].map((level) => (
                    <button
                      key={level}
                      onClick={() => setDifficulty(level)}
                      className={`flex-1 py-2 rounded-xl border text-sm transition-all ${
                        difficulty === level 
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-md shadow-amber-500/10' 
                          : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-4 md:border-l md:border-slate-800 md:pl-8">
              <label className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-4">
                문제 유형
              </label>
              <div className="flex flex-col gap-3">
                {[
                  { id: 'MULTIPLE_CHOICE', label: '객관식 (5지 선다)', emoji: '📋' },
                  { id: 'SHORT_ANSWER', label: '단답형 (짧은 답)', emoji: '✏️' },
                  { id: 'ESSAY', label: '서술형 (긴 답)', emoji: '📝' },
                  { id: 'CSAT', label: '수능형 (논리 추론)', emoji: '🎓' },
                ].map((type) => (
                  <button
                    key={type.id}
                    onClick={() => {
                      if (selectedTypes.includes(type.id)) {
                        if (selectedTypes.length > 1) setSelectedTypes(selectedTypes.filter(t => t !== type.id));
                      } else {
                        setSelectedTypes([...selectedTypes, type.id]);
                      }
                    }}
                    className={`px-4 py-3 rounded-xl border text-sm transition-all flex items-center justify-between ${
                      selectedTypes.includes(type.id) 
                        ? 'bg-sky-500/20 border-sky-500/50 text-sky-100 shadow-lg shadow-sky-500/10' 
                        : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <span>{type.emoji} {type.label}</span>
                    {selectedTypes.includes(type.id) && <CheckCircle2 size={16} className="text-sky-400" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Start Button ── */}
      <motion.button
        whileHover={apiKey && files.length > 0 && selectedTypes.length > 0 ? { scale: 1.02 } : {}}
        whileTap={apiKey && files.length > 0 && selectedTypes.length > 0 ? { scale: 0.98 } : {}}
        onClick={handleStart}
        disabled={!apiKey || files.length === 0 || isProcessing || selectedTypes.length === 0}
        className="mt-12 mb-12 btn-premium px-12 md:px-16 py-5 rounded-[24px] font-bold flex items-center gap-3 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed text-lg md:text-xl shadow-2xl"
      >
        {!apiKey ? '🔑 API 키를 먼저 설정하세요' : selectedTypes.length === 0 ? '유형을 1개 이상 선택하세요' : '문제 생성 시작'} <ChevronRight size={24} />
      </motion.button>
    </main>
  );
}
