import React, { useState, useEffect, useCallback, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, addDoc, collection, query, where, getDocs, onSnapshot, Timestamp, serverTimestamp, setLogLevel, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Play, Square, ListChecks, CalendarDays, Edit3, Trash2, Clock, BookOpen, ChevronLeft, ChevronRight, Save, Columns, Rows, X, Menu, Moon, Sun, BarChartHorizontalBig, PieChart, ChevronsLeft, ChevronsRight, LogOut, UserPlus, Info, Download, UserCheck, Wand2 } from 'lucide-react';
// import ReactConfetti from 'react-confetti'; // Temporarily commented out due to build environment


// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyB5FUBj6P5a1pNY4Y1vu0HxnPTrsJG1srE",
  authDomain: "my-time-logger-app.firebaseapp.com",
  projectId: "my-time-logger-app",
  storageBucket: "my-time-logger-app.firebasestorage.app",
  messagingSenderId: "1076801387988",
  appId: "1:1076801387988:web:879fdd43cf34666afe2a41",
  measurementId: "G-BCPEPC53G0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
setLogLevel('debug'); 

// --- App Context for Auth State ---
const AppContext = React.createContext();

// --- Helper Functions ---
const getWeekDetails = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNumber = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return { year: d.getUTCFullYear(), weekNumber };
};

const getWeekDates = (year, weekNumber) => {
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const jan4Day = jan4.getUTCDay() || 7; 
    const firstMondayOfYear = new Date(jan4);
    firstMondayOfYear.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
    const monday = new Date(firstMondayOfYear);
    monday.setUTCDate(firstMondayOfYear.getUTCDate() + (weekNumber - 1) * 7);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return { startDate: monday, endDate: sunday };
};

const formatDateForDisplay_YYYYMMDD_periods = (dateInput, options = { year: 'numeric', month: '2-digit', day: '2-digit' }) => {
    if (!dateInput) return '';
    let date = dateInput;
    if (date instanceof Timestamp) {
        date = date.toDate();
    }
    if (!(date instanceof Date) || isNaN(date.valueOf())) {
        console.warn("formatDateForDisplay_YYYYMMDD_periods received an invalid date:", dateInput);
        return ''; 
    }
    return date.toLocaleDateString('zh-CN', options).replace(/\//g, '.');
};

const formatDateForStorage_YYYYMMDD_hyphens = (dateInput) => {
    if (!dateInput) return '';
    let date = dateInput;
    if (date instanceof Timestamp) {
        date = date.toDate();
    }
    if (!(date instanceof Date) || isNaN(date.valueOf())) {
        console.warn("formatDateForStorage_YYYYMMDD_hyphens received an invalid date:", dateInput);
        return ''; 
    }
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0'); 
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatTime = (dateInput) => {
    if (!dateInput) return '';
    let date = dateInput;
    if (date instanceof Timestamp) {
        date = date.toDate();
    }
    if (!(date instanceof Date) || isNaN(date.valueOf())) {
        console.warn("formatTime received an invalid date:", dateInput);
        return 'N/A';
    }
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
};

const formatDuration = (durationMs, short = false) => {
    if (durationMs === null || durationMs === undefined || isNaN(Number(durationMs))) return 'N/A';
    const numDurationMs = Number(durationMs);
    if (numDurationMs < 0) return '无效';
    
    const totalSeconds = Math.floor(numDurationMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (short) {
        if (hours > 0) return `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`;
        if (minutes > 0) return `${minutes}m ${seconds > 0 ? `${seconds}s` : ''}`;
        if (seconds > 0) return `${seconds}s`;
        if (numDurationMs > 0) return `<1s`;
        return '0s';
    }

    let result = '';
    if (hours > 0) result += `${hours}小时 `;
    if (minutes > 0) result += `${minutes}分钟 `;
    if (hours === 0 && minutes === 0 && seconds === 0 && numDurationMs > 0) { 
        result = `${numDurationMs}毫秒`;
    } else if (seconds > 0 || (hours === 0 && minutes === 0)) { 
         result += `${seconds}秒`;
    }
    return result.trim() || '0秒';
};


// --- Components (Defined before App component) ---

// Modal Component
function Modal({ isOpen, onClose, title, children, size = 'max-w-lg' }) { 
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity duration-300 ease-in-out" onClick={onClose}> 
            <div 
                className={`bg-white dark:bg-slate-800 p-6 rounded-xl shadow-2xl w-full ${size} flex flex-col transform transition-all duration-300 ease-in-out max-h-[90vh]`} 
                onClick={(e) => e.stopPropagation()} 
            >
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
                    <button 
                        onClick={onClose} 
                        className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 p-1.5 -mr-1.5 -mt-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        aria-label="关闭模态框"
                    >
                        <X size={20}/>
                    </button>
                </div>
                <div className="overflow-y-auto flex-grow pr-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent"> 
                    {children}
                </div>
            </div>
        </div>
    );
};

// Current Activity Tracker
function CurrentActivityTracker() { 

    const { userId, isAuthReady, db: contextDb, firebaseConfig } = useContext(AppContext);
const contextAppId = firebaseConfig.appId;
    const [currentEvent, setCurrentEvent] = useState(null); 
    const [eventName, setEventName] = useState(''); 
    const [prospectiveEventName, setProspectiveEventName] = useState(''); 
    const [isLogging, setIsLogging] = useState(false);
    const [showEditActiveEventModal, setShowEditActiveEventModal] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!userId || !isAuthReady) return; 
        const loadActiveEvent = async () => {
            const activeEventRef = doc(contextDb, `artifacts/${contextAppId}/users/${userId}/activeEvent/current`);
            try {
                const docSnap = await getDoc(activeEventRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data && data.startTime && typeof data.startTime.toDate === 'function') {
                        setCurrentEvent({ ...data, name: data.name || "新活动", startTime: data.startTime.toDate(), id: docSnap.id });
                        setEventName(data.name || "新活动"); 
                        setIsLogging(true);
                        setProspectiveEventName(''); 
                    } else {
                        setCurrentEvent(null); setEventName(''); setIsLogging(false);
                    }
                } else {
                    setIsLogging(false); 
                }
            } catch (error) {
                setIsLogging(false);
            }
        };
        loadActiveEvent();
    }, [userId, isAuthReady, contextDb, contextAppId]);


    const handleStartEvent = async () => {
console.log("按钮被点击了");

        if (!userId) { return; }
        setIsLoading(true);
        const nameToUse = prospectiveEventName.trim() || "新活动";
        const newEvent = { name: nameToUse, startTime: serverTimestamp() };
        try {
            const activeEventRef = doc(contextDb, `artifacts/${contextAppId}/users/${userId}/activeEvent/current`);
            await setDoc(activeEventRef, newEvent);
            setCurrentEvent({ name: nameToUse, startTime: new Date(), id: 'current' }); 
            setEventName(nameToUse); 
            setIsLogging(true);
            setProspectiveEventName(''); 
        } catch (error) { console.error("开始事件失败:", error); }
        setIsLoading(false);
    };

    const handleStopEvent = async () => {
        if (!userId || !currentEvent || !currentEvent.startTime) { return; }
        setIsLoading(true);
        const endTime = new Date();
        let startTime = currentEvent.startTime; 
        if (!(startTime instanceof Date) || isNaN(startTime.valueOf())) {
            if (currentEvent.startTime && typeof currentEvent.startTime.toDate === 'function') {
                startTime = currentEvent.startTime.toDate();
            } else {
                setIsLoading(false); return;
            }
        }
        const durationMs = endTime.getTime() - startTime.getTime();
        try {
            await addDoc(collection(contextDb, `artifacts/${contextAppId}/users/${userId}/events`), {
                name: currentEvent.name || "未命名活动", 
                startTime: Timestamp.fromDate(startTime), 
                endTime: Timestamp.fromDate(endTime),
                durationMs: durationMs,
                date: formatDateForStorage_YYYYMMDD_hyphens(startTime), 
                createdAt: serverTimestamp(),
            });
            const activeEventRef = doc(contextDb, `artifacts/${contextAppId}/users/${userId}/activeEvent/current`);
            await deleteDoc(activeEventRef);
            setCurrentEvent(null); setEventName(''); setIsLogging(false);
        } catch (error) { console.error("结束事件并保存失败:", error); }
        setIsLoading(false);
    };
    
    const handleSaveActiveEventName = async () => {
        if (!userId || !currentEvent || !eventName.trim()) { return; }
        setIsLoading(true);
        try {
            const activeEventRef = doc(contextDb, `artifacts/${contextAppId}/users/${userId}/activeEvent/current`);
            await updateDoc(activeEventRef, { name: eventName });
            setCurrentEvent(prev => ({ ...prev, name: eventName }));
            setShowEditActiveEventModal(false);
        } catch (error) { console.error("保存事件名称失败:", error); }
        setIsLoading(false);
    };

    return (
        <div className="p-6 bg-white dark:bg-slate-800 shadow-xl rounded-xl mb-6">
            <h2 className="text-2xl font-semibold mb-4 text-slate-700 dark:text-slate-200">当前活动</h2>
            {!isLogging && (
                 <div className="mb-4">
                    <input type="text" value={prospectiveEventName} onChange={(e) => setProspectiveEventName(e.target.value)} placeholder="输入新事件名称 (可选)" className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all" disabled={isLogging || !userId} />
                </div>
            )}
            {isLogging && currentEvent ? (
                <div className="mb-4 p-3 bg-sky-50 dark:bg-sky-700/30 rounded-lg">
                    <p className="text-lg text-sky-600 dark:text-sky-300">正在记录: <span className="font-bold">{currentEvent.name || "加载中..."}</span></p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">开始于: {formatTime(currentEvent.startTime)}</p>
                </div>
            ) : (!isLogging && <p className="text-slate-600 dark:text-slate-400 mb-4">没有正在进行的活动。</p>)}
            <div className="flex space-x-3">
                {!isLogging ? (
                    <button onClick={handleStartEvent} disabled={isLoading || !userId} className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out disabled:opacity-60 flex items-center justify-center"><Play size={20} className="mr-2" /> {isLoading ? "处理中..." : "开始新事件"}</button>
                ) : (
                    <button onClick={handleStopEvent} disabled={isLoading || !currentEvent} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out disabled:opacity-60 flex items-center justify-center"><Square size={20} className="mr-2" /> {isLoading ? "处理中..." : "结束当前事件"}</button>
                )}
                 {isLogging && currentEvent && ( <button onClick={() => { setEventName(currentEvent.name); setShowEditActiveEventModal(true);}} className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out flex items-center justify-center"><Edit3 size={20} className="mr-2" /> 编辑名称</button>)}
            </div>
             <Modal isOpen={showEditActiveEventModal && isLogging} onClose={() => setShowEditActiveEventModal(false)} title="编辑当前事件名称">
                <input type="text" value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="输入事件名称" className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white mb-4 focus:ring-2 focus:ring-sky-500"/>
                <button onClick={handleSaveActiveEventName} disabled={isLoading} className="w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md transition-colors disabled:opacity-60">{isLoading ? "保存中..." : "保存名称"}</button>
            </Modal>
        </div>
    );
};

// Daily Log View
function DailyLogView() { 
    const { userId, isAuthReady, db: contextDb, firebaseConfig } = useContext(AppContext);
const contextAppId = firebaseConfig.appId;

    const [selectedDate, setSelectedDate] = useState(formatDateForStorage_YYYYMMDD_hyphens(new Date()));
    const [events, setEvents] = useState([]);
    const [eventSummary, setEventSummary] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
    const [eventToDelete, setEventToDelete] = useState(null);
    const [showEditLoggedEventModal, setShowEditLoggedEventModal] = useState(false);
    const [loggedEventToEdit, setLoggedEventToEdit] = useState(null);
    const [editedLoggedEventName, setEditedLoggedEventName] = useState('');
    const [dailyViewMode, setDailyViewMode] = useState('time-event'); 
    const [analysisPeriod, setAnalysisPeriod] = useState('week'); 
    const [analysisData, setAnalysisData] = useState([]);
    const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
    const [currentAnalysisDate, setCurrentAnalysisDate] = useState(new Date());

    const [aiAnalysis, setAiAnalysis] = useState('');
    const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false);


    // Fetch daily events
    const fetchDailyEvents = useCallback((dateStr_YYYYMMDD) => { 
        if (!userId || !isAuthReady) { setEvents([]); setEventSummary({}); return () => {}; }
        setIsLoading(true);
        try {
            const q = query(collection(contextDb, `artifacts/${contextAppId}/users/${userId}/events`), where("date", "==", dateStr_YYYYMMDD));
            const unsubscribe = onSnapshot(q, (querySnapshot) => {
                const fetchedEvents = [];
                querySnapshot.forEach((doc) => { fetchedEvents.push({ id: doc.id, ...doc.data() }); });
                fetchedEvents.sort((a, b) => {
                    let timeAValue = 0, timeBValue = 0;
                    if (a.startTime?.toDate) timeAValue = a.startTime.toDate().getTime();
                    else if (a.startTime?.seconds) timeAValue = new Date(a.startTime.seconds * 1000).getTime();
                    else if (a.startTime instanceof Date) timeAValue = a.startTime.getTime();
                    if (b.startTime?.toDate) timeBValue = b.startTime.toDate().getTime();
                    else if (b.startTime?.seconds) timeBValue = new Date(b.startTime.seconds * 1000).getTime();
                    else if (b.startTime instanceof Date) timeBValue = b.startTime.getTime();
                    return timeAValue - timeBValue;
                });
                setEvents(fetchedEvents);
                const summary = {};
                fetchedEvents.forEach(event => {
                    const eventNameKey = event.name || "未命名活动";
                    if (!summary[eventNameKey]) summary[eventNameKey] = { totalDurationMs: 0, count: 0 };
                    const duration = Number(event.durationMs);
                    if (!isNaN(duration)) summary[eventNameKey].totalDurationMs += duration;
                    summary[eventNameKey].count += 1;
                });
                setEventSummary(summary);
                setIsLoading(false);
            }, (error) => { console.error("获取事件失败 (onSnapshot):", error); setIsLoading(false); });
            return unsubscribe; 
        } catch (error) { console.error("获取事件查询构建失败:", error); setIsLoading(false); return () => {}; }
    }, [userId, isAuthReady, contextAppId, contextDb]); 

    useEffect(() => {
        let unsubscribe = () => {}; 
        if (isAuthReady && userId && (dailyViewMode === 'time-event' || dailyViewMode === 'event-log')) {
             unsubscribe = fetchDailyEvents(selectedDate); 
        }
        return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
    }, [selectedDate, dailyViewMode, fetchDailyEvents, isAuthReady, userId]); 

    // Fetch and process analysis data
    const fetchAnalysisData = useCallback(async (period, date) => {
        if (!userId || !isAuthReady) return;
        setIsAnalysisLoading(true);
        setAiAnalysis(''); // Clear previous AI analysis
        let startDate, endDate;
        const targetDate = new Date(date); 
        targetDate.setHours(0,0,0,0);

        if (period === 'week') {
            const dayOfWeek = targetDate.getUTCDay();
            const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            startDate = new Date(targetDate);
            startDate.setUTCDate(targetDate.getUTCDate() + diffToMonday);
            endDate = new Date(startDate);
            endDate.setUTCDate(startDate.getUTCDate() + 6);
        } else if (period === 'month') {
            startDate = new Date(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), 1);
            endDate = new Date(targetDate.getUTCFullYear(), targetDate.getUTCMonth() + 1, 0);
        } else { 
            setIsAnalysisLoading(false); return;
        }
        
        const startDateStr = formatDateForStorage_YYYYMMDD_hyphens(startDate);
        const endDateStr = formatDateForStorage_YYYYMMDD_hyphens(endDate);
        
        try {
            const eventsRef = collection(contextDb, `artifacts/${contextAppId}/users/${userId}/events`);
            const q = query(eventsRef, where("date", ">=", startDateStr), where("date", "<=", endDateStr));
            const querySnapshot = await getDocs(q);
            const periodEvents = [];
            querySnapshot.forEach((doc) => periodEvents.push(doc.data()));

            const summary = {};
            periodEvents.forEach(event => {
                const eventNameKey = event.name || "未命名活动";
                if (!summary[eventNameKey]) summary[eventNameKey] = { totalDurationMs: 0, count: 0 };
                const duration = Number(event.durationMs);
                if (!isNaN(duration)) summary[eventNameKey].totalDurationMs += duration;
                summary[eventNameKey].count += 1;
            });
            const sortedAnalysisData = Object.entries(summary)
                .map(([name, data]) => ({ name, ...data }))
                .sort((a,b) => b.totalDurationMs - a.totalDurationMs); 
            setAnalysisData(sortedAnalysisData);
        } catch (error) { console.error(`获取 ${period} 分析数据失败:`, error); setAnalysisData([]); }
        setIsAnalysisLoading(false);
    }, [userId, isAuthReady, contextAppId, contextDb]);

    useEffect(() => {
        if (dailyViewMode === 'analysis') {
            fetchAnalysisData(analysisPeriod, currentAnalysisDate);
        }
    }, [dailyViewMode, analysisPeriod, currentAnalysisDate, fetchAnalysisData]);
    
    const handleGenerateAnalysis = async () => {
        if (!analysisData || analysisData.length === 0) {
            alert("没有可供分析的数据。");
            return;
        }
        setIsGeneratingAnalysis(true);
        setAiAnalysis('');
        
        const dataString = analysisData.map(item => `${item.name}: ${formatDuration(item.totalDurationMs)}`).join(', ');
        const prompt = `You are a time management expert. Based on the following time distribution for the past ${analysisPeriod === 'week' ? 'week' : 'month'}, please provide some observations and suggestions for better balance or productivity. Keep the tone supportive and constructive. Time distribution: ${dataString}. Respond in Chinese.`;

        try {
            const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
            const payload = { contents: chatHistory };
            const apiKey = "";
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
                setAiAnalysis(result.candidates[0].content.parts[0].text);
            } else {
                setAiAnalysis("无法生成分析建议，请稍后再试。");
            }
        } catch (error) {
            console.error("Error calling Gemini API:", error);
            setAiAnalysis("调用AI分析时出错，请检查网络连接或API配置。");
        } finally {
            setIsGeneratingAnalysis(false);
        }
    };


    const handleDateChange = (e) => {
        const newDate = e.target.value;
        setSelectedDate(newDate);
        setCurrentAnalysisDate(new Date(newDate + "T00:00:00Z")); 
    };
    const changeDate = (offset) => {
        const currentDateObj = new Date(selectedDate + "T00:00:00Z"); 
        currentDateObj.setUTCDate(currentDateObj.getUTCDate() + offset);
        const newDateStr = formatDateForStorage_YYYYMMDD_hyphens(currentDateObj);
        setSelectedDate(newDateStr);
        setCurrentAnalysisDate(currentDateObj);
    };
     const changeAnalysisPeriodDate = (offset) => {
        const newDate = new Date(currentAnalysisDate);
        if (analysisPeriod === 'week') newDate.setUTCDate(newDate.getUTCDate() + (offset * 7));
        else if (analysisPeriod === 'month') newDate.setUTCMonth(newDate.getUTCMonth() + offset);
        setCurrentAnalysisDate(newDate);
    };

    const confirmDeleteEvent = (eventId) => { setEventToDelete(eventId); setShowDeleteConfirmModal(true); };
    const handleDeleteConfirmed = async () => {
        if (!userId || !eventToDelete) return;
        try { await deleteDoc(doc(contextDb, `artifacts/${contextAppId}/users/${userId}/events`, eventToDelete)); } 
        catch (error) { console.error("删除事件失败:", error); }
        setShowDeleteConfirmModal(false); setEventToDelete(null);
    };
    const openEditLoggedEventModal = (event) => { setLoggedEventToEdit(event); setEditedLoggedEventName(event.name || ''); setShowEditLoggedEventModal(true); };
    const handleSaveEditedLoggedEventName = async () => {
        if (!userId || !loggedEventToEdit || !editedLoggedEventName.trim()) { console.warn("编辑的事件名称不能为空或未选择事件。"); return; }
        setIsLoading(true); 
        try {
            const eventRef = doc(contextDb, `artifacts/${contextAppId}/users/${userId}/events`, loggedEventToEdit.id);
            await updateDoc(eventRef, { name: editedLoggedEventName });
            setShowEditLoggedEventModal(false); setLoggedEventToEdit(null);
        } catch (error) { console.error("更新已记录的事件名称失败:", error); }
        setIsLoading(false);
    };
    
    const maxDurationForBar = analysisData.length > 0 ? Math.max(...analysisData.map(d => d.totalDurationMs), 1) : 1;
    const totalDurationAllEvents = analysisData.reduce((sum, item) => sum + item.totalDurationMs, 0);

    const handleExportDailyEvents = () => {
        if (events.length === 0) {
            console.warn("当前日期没有事件可以导出。");
            return;
        }
        const headers = "事件名称,开始时间,结束时间,持续时长(毫秒),日期\n";
        const csvContent = events.map(event => {
            const name = `"${(event.name || '').replace(/"/g, '""')}"`;
            const startTime = `"${formatTime(event.startTime)}"`;
            const endTime = `"${formatTime(event.endTime)}"`;
            return `${name},${startTime},${endTime},${event.durationMs},"${event.date}"`;
        }).join("\n");

        const blob = new Blob(["\uFEFF" + headers + csvContent], { type: 'text/csv;charset=utf-8;' }); 
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `事件日志_${selectedDate}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };


    return (
        <div className="p-6 bg-white dark:bg-slate-800 shadow-xl rounded-xl">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-5">
                <h2 className="text-2xl font-semibold text-slate-700 dark:text-slate-200">详细日记与分析</h2>
                <div className="flex space-x-1 sm:space-x-2 mt-3 sm:mt-0 border border-slate-300 dark:border-slate-600 rounded-lg p-1">
                    <button onClick={() => setDailyViewMode('time-event')} className={`px-3 py-1.5 text-sm font-medium rounded-md ${dailyViewMode === 'time-event' ? 'bg-sky-500 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>时间-事件日志</button>
                    <button onClick={() => setDailyViewMode('event-log')} className={`px-3 py-1.5 text-sm font-medium rounded-md ${dailyViewMode === 'event-log' ? 'bg-sky-500 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>事件日志</button>
                    <button onClick={() => setDailyViewMode('analysis')} className={`px-3 py-1.5 text-sm font-medium rounded-md ${dailyViewMode === 'analysis' ? 'bg-sky-500 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>数据分析</button>
                </div>
            </div>

            {dailyViewMode !== 'analysis' && (
                <div className="mb-6 flex items-center space-x-3 bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg">
                    <button onClick={() => changeDate(-1)} className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"><ChevronLeft size={20} className="text-slate-600 dark:text-slate-300"/></button>
                    <input type="date" value={selectedDate} onChange={handleDateChange} className="p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 flex-grow text-center"/>
                    <button onClick={() => changeDate(1)} className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"><ChevronRight size={20} className="text-slate-600 dark:text-slate-300"/></button>
                    <button onClick={handleExportDailyEvents} className="ml-auto bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium py-2 px-3 rounded-lg shadow-sm flex items-center transition-colors disabled:opacity-50" disabled={events.length === 0}><Download size={16} className="mr-1.5"/>导出本页CSV</button>
                </div>
            )}

            {isLoading && dailyViewMode !== 'analysis' && <p className="text-slate-500 dark:text-slate-400 text-center py-4">加载中...</p>}
            {!isLoading && !userId && isAuthReady && <p className="text-slate-500 dark:text-slate-400 text-center py-4">请先登录以查看记录。</p>}
            
            {dailyViewMode === 'time-event' && !isLoading && userId && (
                events.length === 0 ? <p className="text-slate-500 dark:text-slate-400 text-center py-4">选择的日期没有事件。</p> :
                <ul className="space-y-3">
                    {events.map(event => (
                        <li key={event.id} className="p-3.5 bg-slate-50 dark:bg-slate-700/60 rounded-lg shadow-sm flex justify-between items-center hover:shadow-md transition-shadow">
                            <div className="flex-grow"><p className="font-semibold text-slate-800 dark:text-slate-100">{event.name || "未命名活动"}</p><p className="text-sm text-slate-500 dark:text-slate-400">{formatTime(event.startTime)} - {formatTime(event.endTime)}<span className="ml-3 text-sky-600 dark:text-sky-400 font-medium">({formatDuration(event.durationMs)})</span></p></div>
                            <div className="flex space-x-2"><button onClick={() => openEditLoggedEventModal(event)} className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 p-1.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-700/50 transition-colors"><Edit3 size={16} /></button><button onClick={() => confirmDeleteEvent(event.id)} className="text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-700/50 transition-colors"><Trash2 size={16} /></button></div>
                        </li>))}
                </ul>
            )}

            {dailyViewMode === 'event-log' && !isLoading && userId && (
                 Object.keys(eventSummary).length > 0 ? (<ul className="space-y-2">{Object.entries(eventSummary).map(([name, data]) => (<li key={name} className="p-3 bg-slate-50 dark:bg-slate-700/60 rounded-lg shadow-sm"><p className="font-semibold text-slate-800 dark:text-slate-100">{name || "未命名活动"}: <span className="text-green-600 dark:text-green-400 font-medium">{formatDuration(data.totalDurationMs)}</span> ({data.count} 次)</p></li>))}</ul>) : (<p className="text-slate-500 dark:text-slate-400 text-center py-3">没有可摘要的事件。</p>)
            )}

            {dailyViewMode === 'analysis' && (
                <div className="mt-4">
                    <div className="flex items-center justify-center space-x-2 mb-6 bg-slate-100 dark:bg-slate-700/50 p-3 rounded-lg">
                        <button onClick={() => changeAnalysisPeriodDate(-1)} className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"><ChevronLeft size={20}/></button>
                        <select value={analysisPeriod} onChange={(e) => setAnalysisPeriod(e.target.value)} className="p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500">
                            <option value="week">周视图</option>
                            <option value="month">月视图</option>
                        </select>
                        <span className="text-slate-700 dark:text-slate-300 font-medium text-sm sm:text-base">
                            {analysisPeriod === 'week' && `${formatDateForDisplay_YYYYMMDD_periods(getWeekDates(currentAnalysisDate.getFullYear(), getWeekDetails(currentAnalysisDate).weekNumber).startDate)} - ${formatDateForDisplay_YYYYMMDD_periods(getWeekDates(currentAnalysisDate.getFullYear(), getWeekDetails(currentAnalysisDate).weekNumber).endDate)}`}
                            {analysisPeriod === 'month' && `${currentAnalysisDate.getFullYear()}年 ${currentAnalysisDate.getMonth() + 1}月`}
                        </span>
                        <button onClick={() => changeAnalysisPeriodDate(1)} className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"><ChevronRight size={20}/></button>
                    </div>
                    {isAnalysisLoading && <p className="text-slate-500 dark:text-slate-400 text-center py-4">分析数据加载中...</p>}
                    {!isAnalysisLoading && analysisData.length === 0 && <p className="text-slate-500 dark:text-slate-400 text-center py-4">当前时间范围无事件数据。</p>}
                    {!isAnalysisLoading && analysisData.length > 0 && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg shadow">
                                    <h4 className="text-md font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center"><BarChartHorizontalBig size={18} className="mr-2 text-sky-500"/>事件时长占比 (条形图)</h4>
                                    <div className="space-y-2.5">
                                        {analysisData.map(item => (
                                            <div key={item.name} className="text-sm">
                                                <div className="flex justify-between mb-0.5">
                                                    <span className="truncate text-slate-600 dark:text-slate-300" title={item.name}>{item.name}</span>
                                                    <span className="text-slate-500 dark:text-slate-400">{formatDuration(item.totalDurationMs, true)} ({item.count}次)</span>
                                                </div>
                                                <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2.5 overflow-hidden">
                                                    <div 
                                                        className="bg-sky-500 h-2.5 rounded-full"
                                                        style={{ width: `${Math.max(0, Math.min(100, (item.totalDurationMs / maxDurationForBar) * 100))}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg shadow">
                                    <h4 className="text-md font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center"><PieChart size={18} className="mr-2 text-sky-500"/>事件时长占比 (饼图模拟)</h4>
                                    <div className="w-48 h-48 sm:w-56 sm:h-56 mx-auto my-4 rounded-full relative" style={{
                                        background: `conic-gradient(${analysisData.reduce((acc, item, index) => {
                                            const percentage = (item.totalDurationMs / totalDurationAllEvents) * 100;
                                            const startAngle = acc.currentAngle;
                                            const endAngle = startAngle + percentage;
                                            acc.currentAngle = endAngle;
                                            const hue = (index * (360 / (analysisData.length +1))) % 360;
                                            acc.gradient += `, hsl(${hue}, 70%, 60%) ${startAngle.toFixed(2)}% ${endAngle.toFixed(2)}%`;
                                            return acc;
                                        }, {gradient: '', currentAngle: 0}).gradient.substring(1)})` 
                                    }}>
                                    </div>
                                    <ul className="text-xs space-y-1">
                                        {analysisData.slice(0, 5).map((item, index) => { 
                                            const hue = (index * (360 / (analysisData.length+1))) % 360;
                                            return (
                                                <li key={item.name} className="flex items-center">
                                                    <span className="w-3 h-3 rounded-sm mr-2" style={{backgroundColor: `hsl(${hue}, 70%, 60%)`}}></span>
                                                    <span className="text-slate-600 dark:text-slate-300 truncate" title={item.name}>{item.name}: {formatDuration(item.totalDurationMs, true)} ({((item.totalDurationMs / totalDurationAllEvents) * 100).toFixed(1)}%)</span>
                                                </li>
                                            );
                                        })}
                                        {analysisData.length > 5 && <li className="text-slate-500 dark:text-slate-400">...等</li>}
                                    </ul>
                                </div>
                            </div>
                            <div className="lg:col-span-2 p-4 bg-sky-50 dark:bg-sky-900/40 rounded-lg shadow">
                                <button onClick={handleGenerateAnalysis} disabled={isGeneratingAnalysis} className="w-full bg-gradient-to-r from-purple-500 to-sky-500 hover:from-purple-600 hover:to-sky-600 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 ease-in-out disabled:opacity-70 flex items-center justify-center">
                                    {isGeneratingAnalysis ? (<><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>生成中...</>) : (<>✨ AI 生成时间分析建议</>)}
                                </button>
                                {aiAnalysis && (
                                    <div className="mt-4 p-4 bg-white dark:bg-slate-800 rounded-md shadow-inner">
                                        <p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">{aiAnalysis}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <Modal isOpen={showDeleteConfirmModal} onClose={() => setShowDeleteConfirmModal(false)} title="确认删除"><p className="text-slate-600 dark:text-slate-300 mb-4">确定要删除此事件吗？此操作无法撤销。</p><div className="flex justify-end space-x-3"><button onClick={() => setShowDeleteConfirmModal(false)} className="px-4 py-2 rounded-md text-slate-700 bg-slate-200 hover:bg-slate-300 dark:text-slate-200 dark:bg-slate-600 dark:hover:bg-slate-500 transition-colors">取消</button><button onClick={handleDeleteConfirmed} className="px-4 py-2 rounded-md text-white bg-red-600 hover:bg-red-700 transition-colors">删除</button></div></Modal>
            <Modal isOpen={showEditLoggedEventModal} onClose={() => setShowEditLoggedEventModal(false)} title="编辑已记录事件名称"><input type="text" value={editedLoggedEventName} onChange={(e) => setEditedLoggedEventName(e.target.value)} placeholder="输入事件新名称" className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white mb-4 focus:ring-2 focus:ring-sky-500"/><button onClick={handleSaveEditedLoggedEventName} disabled={isLoading} className="w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md transition-colors disabled:opacity-60">{isLoading ? "保存中..." : "保存新名称"}</button></Modal>
        </div>);
};

// Weekly Planner View
function WeeklyPlanner() { 
    const { userId, isAuthReady, db: contextDb, appId: contextAppId } = useContext(AppContext);
    const [currentWeekDate, setCurrentWeekDate] = useState(new Date()); 
    const [plan, setPlan] = useState(''); const [review, setReview] = useState('');
    const [isLoading, setIsLoading] = useState(false); const [weekDocId, setWeekDocId] = useState('');
    const [displayMode, setDisplayMode] = useState('comparison'); 
    const [weekDateRange, setWeekDateRange] = useState({ start: '', end: ''});
    const [aiSummary, setAiSummary] = useState('');
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

    const updateWeekInfo = useCallback((dateForWeek) => {
        const { year, weekNumber } = getWeekDetails(dateForWeek);
        setWeekDocId(`${year}-W${String(weekNumber).padStart(2, '0')}`);
        const { startDate, endDate } = getWeekDates(year, weekNumber);
        setWeekDateRange({ start: formatDateForDisplay_YYYYMMDD_periods(startDate), end: formatDateForDisplay_YYYYMMDD_periods(endDate) });
    }, []);
    useEffect(() => { updateWeekInfo(currentWeekDate); }, [currentWeekDate, updateWeekInfo]);
    useEffect(() => {
        if (!userId || !weekDocId || !isAuthReady) { setPlan(''); setReview(''); setAiSummary(''); return () => {}; }
        setIsLoading(true);
        const docRef = doc(contextDb, `artifacts/${contextAppId}/users/${userId}/weeklyEntries`, weekDocId);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) { const data = docSnap.data(); setPlan(data.plan || ''); setReview(data.review || ''); setAiSummary(data.aiSummary || '');} 
            else { setPlan(''); setReview(''); setAiSummary('');}
            setIsLoading(false);
        }, (error) => { console.error("获取周计划失败 (onSnapshot):", error); setIsLoading(false); });
        return unsubscribe;
    }, [userId, weekDocId, isAuthReady, contextAppId, contextDb]); 

    const handleSave = async (summaryToSave = aiSummary) => {
        if (!userId || !weekDocId) return; 
        setIsLoading(true);
        try {
            const docRef = doc(contextDb, `artifacts/${contextAppId}/users/${userId}/weeklyEntries`, weekDocId);
            await setDoc(docRef, { plan, review, aiSummary: summaryToSave, weekId: weekDocId, updatedAt: serverTimestamp() }, { merge: true });
        } catch (error) { console.error("保存周记录失败:", error); }
        setIsLoading(false);
    };

    const handleGenerateSummary = async () => {
        if (!plan.trim() || !review.trim()) {
            alert("请先填写周计划和周复盘。");
            return;
        }
        setIsGeneratingSummary(true);
        setAiSummary('');
        const prompt = `You are a productivity coach. Here is my plan for the week: "${plan}". And here is my review of how the week went: "${review}". Please provide a short, encouraging summary of my week in a few bullet points, highlighting my accomplishments, identifying potential areas for improvement based on any discrepancies between plan and review, and offering one actionable tip for the next week. Respond in Chinese.`;
        
        try {
            const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
            const payload = { contents: chatHistory };
            const apiKey = "";
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
                const summary = result.candidates[0].content.parts[0].text;
                setAiSummary(summary);
                await handleSave(summary); // Save the summary immediately after generating
            } else {
                setAiSummary("无法生成周报总结，请稍后再试。");
            }
        } catch (error) {
             console.error("Error calling Gemini API:", error);
            setAiSummary("调用AI分析时出错，请检查网络连接或API配置。");
        } finally {
            setIsGeneratingSummary(false);
        }
    };

    const changeWeek = (offset) => { const newDate = new Date(currentWeekDate); newDate.setDate(newDate.getDate() + (offset * 7)); setCurrentWeekDate(newDate); };
    const renderTextAreas = () => {
        const planTextArea = (<div className={displayMode === 'comparison' ? 'md:col-span-1' : 'col-span-1 md:col-span-2'}><h3 className="text-lg font-semibold mb-2 text-slate-700 dark:text-slate-300">周规划 <span className="text-sm text-slate-500">(本周预期)</span></h3><textarea value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="记录本周计划和目标..." rows="10" className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-sky-500 transition-shadow"/></div>);
        const reviewTextArea = (<div className={displayMode === 'comparison' ? 'md:col-span-1' : 'col-span-1 md:col-span-2'}><h3 className="text-lg font-semibold mb-2 text-slate-700 dark:text-slate-300">周复盘 <span className="text-sm text-slate-500">(本周总结)</span></h3><textarea value={review} onChange={(e) => setReview(e.target.value)} placeholder="记录本周完成情况、心得和反思..." rows="10" className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-sky-500 transition-shadow"/></div>);
        if (displayMode === 'plan') return planTextArea; if (displayMode === 'review') return reviewTextArea;
        if (displayMode === 'comparison') return (<div className="grid md:grid-cols-2 gap-6">{planTextArea}{reviewTextArea}</div>);
        return null;
    };
    const DisplayModeButton = ({ mode, label, icon: Icon }) => (<button onClick={() => setDisplayMode(mode)} className={`flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-150 shadow-sm hover:shadow-md ${displayMode === mode ? 'bg-sky-500 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'}`}>{Icon && <Icon size={16} className="mr-2" />}{label}</button>);
    const handleExportWeeklyLog = () => {
        if (!plan && !review) {
            alert("没有内容可以导出。"); 
            return;
        }
        const content = `周标识: ${weekDocId}\n日期范围: ${weekDateRange.start} - ${weekDateRange.end}\n\n--- 周规划 ---\n${plan}\n\n--- 周复盘 ---\n${review}${aiSummary ? `\n\n--- AI总结 ---\n${aiSummary}`:''}`;
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `周记录_${weekDocId.replace('-W','_第') + '周'}.txt`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="p-6 bg-white dark:bg-slate-800 shadow-xl rounded-xl">
             <div className="flex flex-col sm:flex-row justify-between items-center mb-5">
                <h2 className="text-2xl font-semibold text-slate-700 dark:text-slate-200">周规划与复盘</h2>
                <button 
                    onClick={handleExportWeeklyLog}
                    disabled={isLoading || !userId}
                    className="mt-3 sm:mt-0 bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium py-2 px-4 rounded-lg shadow-sm flex items-center transition-colors disabled:opacity-50"
                >
                    <Download size={16} className="mr-1.5"/> 导出本周记录 (TXT)
                </button>
            </div>
            <div className="mb-6 flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg">
                <div className="flex items-center space-x-2">
                    <button onClick={() => changeWeek(-1)} className="p-2.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"><ChevronLeft size={20} className="text-slate-600 dark:text-slate-300"/></button>
                    <p className="font-semibold text-lg text-slate-700 dark:text-slate-200 text-center min-w-[180px]">
                        {weekDateRange.start && weekDateRange.end ? `${weekDateRange.start} - ${weekDateRange.end}` : '加载中...'}
                    </p>
                    <button onClick={() => changeWeek(1)} className="p-2.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"><ChevronRight size={20} className="text-slate-600 dark:text-slate-300"/></button>
                </div>
                <div className="flex space-x-2 mt-3 sm:mt-0">
                    <DisplayModeButton mode="plan" label="周计划" icon={Rows} />
                    <DisplayModeButton mode="review" label="周复盘" icon={Rows} />
                    <DisplayModeButton mode="comparison" label="对比" icon={Columns} />
                </div>
            </div>
            {isLoading && <p className="text-slate-500 dark:text-slate-400 text-center py-4">加载中...</p>}
            {!isLoading && !userId && isAuthReady && <p className="text-slate-500 dark:text-slate-400 text-center py-4">请先登录以查看和编辑周计划。</p>}
            {!isLoading && userId && renderTextAreas()}
            <div className="mt-8 text-center space-y-4">
                <div className="flex items-center justify-center space-x-4">
                     <button onClick={() => handleSave(aiSummary)} disabled={isLoading || !userId} className="bg-sky-500 hover:bg-sky-600 text-white font-semibold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out disabled:opacity-60 flex items-center justify-center"><Save size={20} className="mr-2" /> {isLoading ? "保存中..." : "保存周记录"}</button>
                    <button onClick={handleGenerateSummary} disabled={isGeneratingSummary || !plan.trim() || !review.trim()} className="bg-gradient-to-r from-purple-500 to-sky-500 hover:from-purple-600 hover:to-sky-600 text-white font-semibold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out disabled:opacity-60 flex items-center justify-center">
                        {isGeneratingSummary ? (<><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>生成中...</>) : (<>✨ AI 生成周报总结</>)}
                    </button>
                </div>
                 {aiSummary && (
                    <div className="mt-4 p-4 text-left bg-sky-50 dark:bg-sky-900/40 rounded-lg shadow-inner">
                        <h4 className="text-md font-semibold text-slate-700 dark:text-sky-200 mb-2 flex items-center"><Wand2 size={18} className="mr-2"/> AI 生成总结</h4>
                        <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{aiSummary}</p>
                    </div>
                )}
            </div>
        </div>);
};

// App Component
function App() {
    const [userId, setUserId] = useState(null);
    const [userEmail, setUserEmail] = useState('');
    const [isAnonymous, setIsAnonymous] = useState(true);
    const [isAuthReady, setIsAuthReady] = useState(false); 
    const [currentPage, setCurrentPage] = useState('tracker'); 
    const [theme, setTheme] = useState('light'); 
    const [isNavCollapsed, setIsNavCollapsed] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authMode, setAuthMode] = useState('login'); 
    const [authError, setAuthError] = useState('');
    const [authLoading, setAuthLoading] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
                setUserEmail(user.email || '');
                setIsAnonymous(user.isAnonymous);
                console.log("用户已登录:", user.uid, "匿名:", user.isAnonymous);
                if (showAuthModal && !user.isAnonymous) setShowAuthModal(false);
            } else {
                setUserId(null); setUserEmail(''); setIsAnonymous(true);
                console.log("用户未登录，尝试匿名登录...");
                try {
                    const localInitialAuthToken = null;
                    if (localInitialAuthToken) {
                         await signInWithCustomToken(auth, localInitialAuthToken);
                    } else {
                        await signInAnonymously(auth);
                    }
                } catch (error) {
                    console.error("匿名登录失败:", error);
                    setAuthError("匿名登录失败，请稍后重试。");
                }
            }
            if (!isAuthReady) setIsAuthReady(true); 
        });
        return () => unsubscribe(); 
    }, [isAuthReady, showAuthModal]); 
    
    useEffect(() => {
        if (theme === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
    }, [theme]);

    const toggleTheme = () => setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
    const toggleNavCollapse = () => setIsNavCollapsed(!isNavCollapsed);

    const handleAuthAction = async (email, password) => {
        setAuthLoading(true);
        setAuthError('');
        try {
            if (authMode === 'register') {
                await createUserWithEmailAndPassword(auth, email, password);
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
        } catch (error) {
            console.error(`${authMode} 失败:`, error);
            setAuthError(error.message || `无法${authMode === 'register' ? '注册' : '登录'}，请检查您的邮箱和密码。`);
        }
        setAuthLoading(false);
    };

    const handleSignOut = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("登出失败:", error);
        }
    };


    if (!isAuthReady) {
        return (<div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900"><p className="text-lg text-slate-700 dark:text-slate-200">正在初始化应用...</p></div>);
    }
    
    const NavItem = ({ page, label, icon: Icon }) => (
        <button 
            onClick={() => setCurrentPage(page)} 
            title={label}
            className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ease-in-out group
                        ${currentPage === page 
                            ? 'bg-sky-500 text-white shadow-lg' 
                            : 'text-slate-600 hover:bg-sky-100 dark:text-slate-300 dark:hover:bg-sky-700/50 hover:text-sky-600 dark:hover:text-sky-300'}`}
        >
            <Icon size={20} className={`mr-3 transition-transform duration-200 ${isNavCollapsed ? 'group-hover:scale-110' : ''}`} />
            {!isNavCollapsed && <span className="truncate">{label}</span>}
        </button>
    );
const appId = firebaseConfig.appId;

    return (
        <AppContext.Provider value={{ isAuthReady, userId, db, firebaseConfig }}>
            <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-slate-900' : 'bg-slate-100'} font-sans transition-colors duration-300`}>
                <header className="bg-white dark:bg-slate-800 shadow-lg sticky top-0 z-40 border-b dark:border-slate-700">
                    <div className="container mx-auto px-4 py-3 flex justify-between items-center">
                        <div className="flex items-center"><BookOpen size={32} className="text-sky-500 dark:text-sky-400 mr-2"/>

<h1 className="text-4xl text-blue-600 font-bold text-center mb-8">极简时间日志</h1>

</div>
                        <div className="flex items-center space-x-3">{userId && (isAnonymous ? <span className="text-xs text-yellow-600 dark:text-yellow-400 hidden sm:flex items-center"><Info size={14} className="mr-1"/>匿名访问</span> : <span className="text-sm text-slate-600 dark:text-slate-300 hidden sm:flex items-center"><UserCheck size={16} className="mr-1.5 opacity-70"/> {userEmail}</span>) }
                            {userId && !isAnonymous && <button onClick={handleSignOut} title="登出" className="p-2 rounded-full text-slate-600 hover:bg-red-100 dark:text-slate-300 dark:hover:bg-red-700/50 hover:text-red-600 dark:hover:text-red-300 transition-colors"><LogOut size={20}/></button>}
                             {isAnonymous && <button onClick={() => {setAuthMode('login'); setShowAuthModal(true);}} title="登录/注册" className="p-2 rounded-full text-slate-600 hover:bg-green-100 dark:text-slate-300 dark:hover:bg-green-700/50 hover:text-green-600 dark:hover:text-green-300 transition-colors"><UserPlus size={20}/></button>}
                            <button onClick={toggleTheme} title="切换主题" className="p-2 rounded-full text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors">
                                {theme === 'light' ?  <Moon size={20}/> : <Sun size={20}/>}
                            </button>
                             <button onClick={toggleNavCollapse} title={isNavCollapsed ? "展开导航" : "收起导航"} className="p-2 rounded-full text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors md:hidden">
                                <Menu size={20}/>
                            </button>
                        </div>
                    </div>
                </header>
                { userId && isAnonymous && (
                     <div className="container mx-auto px-4 mt-2">
                        <div className="bg-yellow-100 dark:bg-yellow-700/30 border-l-4 border-yellow-500 text-yellow-700 dark:text-yellow-200 p-3 rounded-md text-xs flex items-center shadow">
                           <Info size={16} className="mr-2 flex-shrink-0"/> <div>您当前为匿名访问，数据仅保存在此浏览器。为实现跨设备同步，请 <button onClick={() => {setAuthMode('register'); setShowAuthModal(true);}} className="font-semibold underline hover:text-yellow-800 dark:hover:text-yellow-100">注册账户</button>。</div>
                        </div>
                    </div>
                )}

                <div className="container mx-auto px-2 sm:px-4 py-6 flex flex-col md:flex-row gap-6">
                    <nav className={`bg-white dark:bg-slate-800 p-3 rounded-xl shadow-xl transition-all duration-300 ease-in-out md:sticky md:top-24 self-start ${isNavCollapsed ? 'md:w-16' : 'md:w-64'} ${isNavCollapsed && 'hidden md:block'}`}>
                        <button onClick={toggleNavCollapse} title={isNavCollapsed ? "展开导航" : "收起导航"} className={`w-full hidden md:flex items-center justify-center p-2 mb-2 text-slate-500 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-300 rounded-md hover:bg-sky-100 dark:hover:bg-sky-700/50 transition-colors`}>
                           {isNavCollapsed ? <ChevronsRight size={20}/> : <ChevronsLeft size={20}/>}
                        </button>
                        <ul className="space-y-1.5">
                            <li><NavItem page="tracker" label="当前活动" icon={Clock} /></li>
                            <li><NavItem page="daily" label="详细日记 & 分析" icon={ListChecks} /></li> 
                            <li><NavItem page="weekly" label="周计划与复盘" icon={CalendarDays} /></li>
                        </ul>
                    </nav> 
                    <main className="flex-1 min-w-0"> 
                        {currentPage === 'tracker' && (<CurrentActivityTracker />)}
                        {currentPage === 'daily' && <DailyLogView />}
                        {currentPage === 'weekly' && <WeeklyPlanner />}
                    </main>
                </div>

                <Modal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} title={authMode === 'login' ? '登录您的账户' : '创建新账户'}>
                    <form onSubmit={(e) => { e.preventDefault(); handleAuthAction(e.target.email.value, e.target.password.value); }} className="space-y-4">
                        <div>
                            <label htmlFor="auth-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">邮箱:</label>
                            <input id="auth-email" name="email" type="email" required className="mt-1 w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-sky-500"/>
                        </div>
                        <div>
                            <label htmlFor="auth-password"className="block text-sm font-medium text-slate-700 dark:text-slate-300">密码:</label>
                            <input id="auth-password" name="password" type="password" required minLength="6" className="mt-1 w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-sky-500"/>
                        </div>
                        {authError && <p className="text-sm text-red-600 dark:text-red-400">{authError}</p>}
                        <button type="submit" disabled={authLoading} className="w-full bg-sky-600 hover:bg-sky-700 text-white font-semibold py-3 px-4 rounded-lg shadow-md transition-colors disabled:opacity-70">
                            {authLoading ? '处理中...' : (authMode === 'login' ? '登录' : '注册')}
                        </button>
                        <button type="button" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="w-full text-sm text-sky-600 dark:text-sky-400 hover:underline text-center">
                            {authMode === 'login' ? '还没有账户？点击注册' : '已有账户？点击登录'}
                        </button>
                    </form>
                </Modal>

                <footer className="text-center py-8 text-sm text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 mt-10">成为一个有历史的人。 &copy; {new Date().getFullYear()} 极简时间日志。</footer>
            </div>
        </AppContext.Provider>
    );
}

export default App;

