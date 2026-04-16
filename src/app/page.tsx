'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Key, FileText, BrainCircuit, ChevronRight, CheckCircle2, RotateCcw, Download, Camera, Settings, XCircle, X } from 'lucide-react';
import { GeminiProvider } from '@/lib/ai/gemini-provider';
import { extractTextFromPdf } from '@/lib/pdf/pdf-processor';
import { QuizResult } from '@/lib/ai/types';
import QuizView from '@/components/quiz/QuizView';
import FullTextHighlight from '@/components/viewer/FullTextHighlight';
import CameraPreview from '@/components/shared/CameraPreview';

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-1.5-flash');
  const [numQuestions, setNumQuestions] = useState(5);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['CSAT', 'MULTIPLE_CHOICE', 'SHORT_ANSWER']);
  const [difficulty, setDifficulty] = useState('보통');
  const [retryMultipleChoice, setRetryMultipleChoice] = useState(true);
  const [quizFontSize, setQuizFontSize] = useState('medium');
  
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [step, setStep] = useState(1);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [fullText, setFullText] = useState('');
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null);
  const [wrongQuestions, setWrongQuestions] = useState<Set<string>>(new Set());
  const [mobileTab, setMobileTab] = useState<'quiz' | 'context'>('quiz');
  const [showSettings, setShowSettings] = useState(false);
  const [uploadMode, setUploadMode] = useState<'file' | 'camera'>('file');
  const [showCamera, setShowCamera] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  // Load settings on mount
  useEffect(() => {
    const savedKey = localStorage.getItem('OCI_QUIZ_API_KEY');
    const savedModel = localStorage.getItem('OCI_QUIZ_MODEL');
    if (savedKey) setApiKey(savedKey);
    if (savedModel) setSelectedModel(savedModel);

    const savedNum = localStorage.getItem('OCI_QUIZ_NUM_QUESTIONS');
    const savedTypes = localStorage.getItem('OCI_QUIZ_TYPES');
    const savedDiff = localStorage.getItem('OCI_QUIZ_DIFFICULTY');
    const savedRetry = localStorage.getItem('OCI_QUIZ_RETRY_CHOICE');
    const savedFont = localStorage.getItem('OCI_QUIZ_FONT_SIZE');

    if (savedNum) setNumQuestions(parseInt(savedNum));
    if (savedTypes) setSelectedTypes(JSON.parse(savedTypes));
    if (savedDiff) setDifficulty(savedDiff);
    if (savedRetry) setRetryMultipleChoice(savedRetry === 'true');
    if (savedFont) setQuizFontSize(savedFont);
  }, []);

  // Save quiz preferences dynamically
  useEffect(() => {
    localStorage.setItem('OCI_QUIZ_NUM_QUESTIONS', numQuestions.toString());
    localStorage.setItem('OCI_QUIZ_TYPES', JSON.stringify(selectedTypes));
    localStorage.setItem('OCI_QUIZ_DIFFICULTY', difficulty);
    localStorage.setItem('OCI_QUIZ_RETRY_CHOICE', retryMultipleChoice.toString());
    localStorage.setItem('OCI_QUIZ_FONT_SIZE', quizFontSize);
  }, [numQuestions, selectedTypes, difficulty, retryMultipleChoice, quizFontSize]);

  const saveSettings = (key: string, model: string) => {
    const sanitizedKey = key.trim().replace(/[^\x20-\x7E]/g, '');
    setApiKey(sanitizedKey);
    setSelectedModel(model);
    localStorage.setItem('OCI_QUIZ_API_KEY', sanitizedKey);
    localStorage.setItem('OCI_QUIZ_MODEL', model);
  };

  const handleDiscoverModels = async () => {
    if (!apiKey) return;
    setIsDiscovering(true);
    try {
      const provider = new GeminiProvider(apiKey);
      const models = await provider.getAvailableModels();
      setDiscoveredModels(models);
      if (models.length > 0 && !models.includes(selectedModel)) {
        setSelectedModel(models[0]);
      }
      alert(`총 ${models.length}개의 모델을 찾았습니다.`);
    } catch (error: any) {
      console.error(error);
      alert(`모델 찾기 실패: ${error.message || '알 수 없는 오류'}`);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleTestConnection = async () => {
    if (!apiKey) return;
    setIsTesting(true);
    try {
      const provider = new GeminiProvider(apiKey, selectedModel);
      await provider.testConnection();
      alert('연결 성공! 모델이 정상적으로 작동합니다.');
    } catch (error: any) {
      console.error(error);
      alert(`연결 실패: ${error.message || '알 수 없는 오류'}\n모델 ID가 정확한지 확인해 주세요.`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleStart = async () => {
    if (!apiKey || files.length === 0 || selectedTypes.length === 0) return;
    setIsProcessing(true);
    try {
      let combinedText = '';
      
      const pdfFiles = files.filter(f => f.type === 'application/pdf');
      const imageFiles = files.filter(f => f.type.startsWith('image/'));

      for (const pdf of pdfFiles) {
        const pages = await extractTextFromPdf(pdf);
        combinedText += pages.map(p => p.text).join('\n') + '\n';
      }

      if (imageFiles.length > 0) {
        combinedText += `[${imageFiles.length}개의 이미지 분석]\n`;
        setImageUrls(imageFiles.map(file => URL.createObjectURL(file)));
      } else {
        setImageUrls([]);
      }

      setFullText(combinedText);
      
      const provider = new GeminiProvider(apiKey, selectedModel);
      const result = await provider.generateQuiz(combinedText, selectedTypes, imageFiles, numQuestions, difficulty);
      
      if (result.extractedText) {
        setFullText(prev => prev + "\n\n=== 📷 이미지에서 추출된 원문 텍스트 ===\n" + result.extractedText);
      }
      
      setQuizResult(result);
      setStep(3); // Generated view
    } catch (error: any) {
      console.error("AI Quiz Generation Error:", error);
      const errStr = String(error.message || error).toLowerCase();
      
      if (errStr.includes("503") || error.status === 503) {
        alert("현재 Google 서버에 요청이 몰려 응답이 지연되고 있습니다. (Error 503)\n잠시 후 다시 시도하시거나, 다른 모델(예: 1.5 Flash)로 변경해 보세요.");
      } else if (errStr.includes("quota") || errStr.includes("429") || errStr.includes("exhausted") || error.status === 429) {
        alert("🚨 API 크레딧 또는 할당량을 모두 소진했습니다!\nGoogle AI Studio에서 잔여 한도를 확인하시거나 과금이 필요할 수 있습니다.");
      } else if (errStr.includes("api key") || errStr.includes("400") || errStr.includes("invalid") || error.status === 400) {
        alert("🚨 API 키가 유효하지 않습니다.\n설정에서 정확한 Gemini API 키를 다시 한 번 붙여넣어 주세요.");
      } else {
        alert(`문제 생성 중 알 수 없는 오류가 발생했습니다.\n\n상세내용: ${error.message}\n네트워크나 설정을 확인해 주세요.`);
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
    } catch (err: any) {
      alert("TXT 다운로드 중 오류가 발생했습니다: " + err.message);
    }
  };

  const handleExportPdf = async () => {
    try {
      if (!quizResult) return;
      const { default: jsPDF } = await import('jspdf');
      const htmlToImage = await import('html-to-image');
      const element = document.getElementById('quiz-content');
      const scroller = document.getElementById('quiz-scroller');
      
      if (!element || !scroller) {
        alert("퀴즈 내용을 찾을 수 없습니다.");
        return;
      }

      // Create a dedicated off-screen clone container to avoid viewport height limits
      const cloneContainer = document.createElement('div');
      cloneContainer.style.position = 'absolute';
      cloneContainer.style.top = '-9999px';
      cloneContainer.style.left = '-9999px';
      cloneContainer.style.width = '800px'; 
      cloneContainer.style.background = '#020617';
      cloneContainer.style.padding = '32px';
      cloneContainer.style.borderRadius = '24px';
      
      const clonedNode = element.cloneNode(true) as HTMLElement;
      cloneContainer.appendChild(clonedNode);
      document.body.appendChild(cloneContainer);

      try {
        await new Promise(r => setTimeout(r, 600)); // give time for css paint and fonts

        const imgData = await htmlToImage.toPng(cloneContainer, {
          backgroundColor: '#020617', 
          pixelRatio: 2,
        });

        if (!imgData || imgData === 'data:,') throw new Error("이미지 렌더링에 실패했습니다. (알 수 없는 데이터 포맷)");

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
      } finally {
        if (cloneContainer.parentNode) {
          cloneContainer.parentNode.removeChild(cloneContainer);
        }
      }
    } catch (err: any) {
      console.error("PDF Export Error:", err);
      alert("PDF 내보내기 중 에러가 발생했습니다: " + (err.message || '알 수 없는 에러'));
    }
  };

  const handleWrong = (qId: string) => {
    setWrongQuestions(prev => new Set(Array.from(prev).concat(qId)));
  };

  const handleShowContext = (context: string) => {
    setActiveHighlight(context);
  };

  if (step === 3 && quizResult) {
    return (
      <main className="min-h-screen p-6 md:p-12 bg-slate-950">
        <div className="max-w-[1600px] mx-auto space-y-8">
          <header className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400">
                {quizResult.title}
              </h2>
              <p className="text-slate-500 mt-1">{quizResult.summary}</p>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setStep(1)}
                className="glass px-4 py-2 rounded-xl text-sm flex items-center gap-2 hover:bg-slate-800 transition-colors"
              >
                <RotateCcw size={16} /> 다시 만들기
              </button>
              <button 
                onClick={handleExportPdf}
                className="btn-premium px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"
              >
                <Download size={16} /> PDF 저장
              </button>
              <button 
                onClick={handleExportTxt}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
              >
                <Download size={16} /> TXT 저장
              </button>
            </div>
          </header>

          {/* Mobile Tabs */}
          <div className="flex lg:hidden bg-slate-900 rounded-xl p-1 mb-6 border border-slate-800">
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
              <div className="flex items-center gap-2 text-amber-500 text-sm font-bold mb-4">
                <span className="p-1 bg-amber-500/10 rounded">💡</span>
                {wrongQuestions.size > 0 ? `${wrongQuestions.size}개의 오답 기록됨. 원문을 확인하세요.` : "문제를 풀어보세요!"}
              </div>
              <div id="quiz-content" className="pb-8">
                <QuizView 
                  questions={quizResult.questions}
                  onCorrect={() => {}} 
                  onWrong={handleWrong}
                  onShowContext={(ctx) => {
                    handleShowContext(ctx);
                    setMobileTab('context'); // auto switch to context view on mobile
                  }}
                  retryMultipleChoice={retryMultipleChoice}
                  quizFontSize={quizFontSize}
                />
              </div>
            </div>
            
            <div className={`sticky top-12 ${mobileTab === 'context' ? 'block' : 'hidden lg:block'}`}>
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

  return (
    <main className="min-h-screen p-8 md:p-24 flex flex-col items-center">
      {/* Settings Modal Toggle */}
      <div className="absolute top-8 right-8">
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="p-3 glass rounded-2xl text-slate-400 hover:text-sky-400 transition-colors"
        >
          <Settings size={24} />
        </button>
      </div>

      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <div className="bg-slate-900/90 backdrop-blur-2xl p-8 rounded-[32px] border border-slate-700 w-full max-w-md shadow-2xl relative">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Settings className="text-sky-400" /> 설정
                </h2>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400">
                  <X size={24} />
                </button>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2 font-noto">Google Gemini API Key</label>
                  <div className="relative">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input 
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="AI Studio에서 발급받은 키를 입력하세요"
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all font-mono text-sm"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-slate-400 font-noto">AI 모델 선택</label>
                    <button 
                      onClick={handleDiscoverModels}
                      disabled={!apiKey || isDiscovering}
                      className="text-[10px] bg-sky-500/10 text-sky-400 px-2 py-1 rounded-md hover:bg-sky-500/20 transition-all flex items-center gap-1"
                    >
                      <RotateCcw size={10} className={isDiscovering ? 'animate-spin' : ''} /> 모델 조회
                    </button>
                  </div>
                  <select 
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl py-4 px-4 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all text-slate-200"
                  >
                    {discoveredModels.length > 0 ? (
                      discoveredModels.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))
                    ) : (
                      <>
                        <option value="gemini-1.5-flash">Gemini 1.5 Flash (기본)</option>
                        <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                        <option value="gemini-1.5-flash-latest">Gemini 1.5 Flash Latest</option>
                        <option value="gemini-pro">Gemini 1.0 Pro</option>
                      </>
                    )}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-2 px-1">
                    {discoveredModels.length > 0 ? '* 사용 가능한 모델 목록을 불러왔습니다.' : '* 404 에러 시 "모델 조회" 버튼을 눌러보세요.'}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-800 space-y-4">
                  <h3 className="text-sm font-bold text-slate-300 mb-2">기타 퀴즈 설정</h3>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm text-slate-300">객관식 재도전 기회</span>
                      <span className="text-xs text-slate-500">오답 시 답을 숨기고 한 번 더 풀게 합니다</span>
                    </div>
                    <button 
                      onClick={() => setRetryMultipleChoice(!retryMultipleChoice)}
                      className={`w-12 h-6 rounded-full transition-colors relative ${retryMultipleChoice ? 'bg-sky-500' : 'bg-slate-700'}`}
                    >
                      <motion.div 
                        animate={{ x: retryMultipleChoice ? 24 : 2 }}
                        className="w-5 h-5 bg-white rounded-full absolute top-[2px]"
                      />
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm text-slate-300">문제 글자 크기</span>
                      <span className="text-xs text-slate-500">풀이 화면의 글자 크기를 조절합니다</span>
                    </div>
                    <select 
                      value={quizFontSize}
                      onChange={(e) => setQuizFontSize(e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm focus:outline-none text-slate-300"
                    >
                      <option value="small">작게</option>
                      <option value="medium">보통</option>
                      <option value="large">크게</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={handleTestConnection}
                    disabled={!apiKey || isTesting}
                    className="flex-1 py-4 bg-slate-800 border border-slate-700 rounded-2xl font-bold hover:bg-slate-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {isTesting ? '중...' : '연결 테스트'}
                  </button>
                  <button 
                    onClick={() => {
                      saveSettings(apiKey, selectedModel);
                      setShowSettings(false);
                    }}
                    className="flex-1 py-4 bg-sky-500 rounded-2xl text-white font-bold hover:bg-sky-600 shadow-lg shadow-sky-500/30 transition-all"
                  >
                    확인
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
        {showCamera && (
          <CameraPreview 
            onCapture={(capturedFiles) => setFiles(prev => [...prev, ...capturedFiles])} 
            onClose={() => setShowCamera(false)} 
          />
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl w-full text-center space-y-6"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 glass rounded-full text-sm text-sky-400 mb-4">
          <BrainCircuit size={16} />
          <span>OCI-Style AI Document Analyzer</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
          문서를 읽고 <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400">
            나만의 문제집
          </span>
          을 만드세요
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          PDF, 이미지, OCI 텍스트를 분석하여 수능형, 객관식, 단답형 문제를 자동 생성합니다. 
          오답 노트와 원문 하이라이트 기능으로 학습 효율을 극대화하세요.
        </p>
      </motion.div>

      <div className="w-full max-w-2xl mt-16 space-y-8">
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
        <div className="glass p-12 rounded-[40px] space-y-6 text-center border-2 border-slate-800/50">
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
                <label className={`flex flex-col items-center justify-center border-2 border-dashed border-slate-700/50 rounded-3xl p-12 w-full hover:bg-white/5 transition-all group ${uploadMode === 'camera' ? 'cursor-pointer' : 'cursor-pointer'}`}>
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
                      <div className="flex flex-wrap gap-2 mt-4 justify-center">
                        {files.map((f, i) => (
                          <div key={i} className="px-3 py-1 bg-sky-500/20 rounded-lg text-xs text-sky-400 border border-sky-500/30 flex items-center gap-2">
                             {f.name.slice(0, 15)}...
                             <X 
                              size={12} 
                              className="cursor-pointer hover:text-white" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setFiles(prev => prev.filter((_, idx) => idx !== i));
                              }}
                             />
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
                        const newFiles = Array.from(e.target.files || []);
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

      {/* Quiz Configuration Panel */}
      <div className="w-full max-w-2xl mt-8">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass p-8 rounded-3xl space-y-8"
        >
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1 space-y-4">
              <div className="flex justify-between items-center">
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

            <div className="flex-2 space-y-4 border-l border-slate-800 pl-8">
              <label className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-4">
                문제 유형
              </label>
              <div className="flex flex-col gap-3">
                {[
                  { id: 'CSAT', label: '수능형 (논리 추론)' },
                  { id: 'MULTIPLE_CHOICE', label: '객관식 (5지 선다)' },
                  { id: 'SHORT_ANSWER', label: '단답형 (서술형)' }
                ].map((type) => (
                  <button
                    key={type.id}
                    onClick={() => {
                      if (selectedTypes.includes(type.id)) {
                        // Prevent unselecting all
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
                    <span>{type.label}</span>
                    {selectedTypes.includes(type.id) && <CheckCircle2 size={16} className="text-sky-400" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.button
        whileHover={apiKey && files.length > 0 && selectedTypes.length > 0 ? { scale: 1.02 } : {}}
        whileTap={apiKey && files.length > 0 && selectedTypes.length > 0 ? { scale: 0.98 } : {}}
        onClick={handleStart}
        disabled={!apiKey || files.length === 0 || isProcessing || selectedTypes.length === 0}
        className="mt-12 btn-premium px-16 py-5 rounded-[24px] font-bold flex items-center gap-3 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed text-xl shadow-2xl"
      >
        {isProcessing ? (
          <div className="animate-spin rounded-full h-6 w-6 border-3 border-white border-t-transparent" />
        ) : (
          <>
            {!apiKey ? 'API 키를 먼저 설정하세요' : selectedTypes.length === 0 ? '유형을 1개 이상 선택하세요' : '문제 생성 시작'} <ChevronRight size={24} />
          </>
        )}
      </motion.button>
    </main>
  );
}
