import { useState, useEffect } from 'react';
import * as Backend from "../wailsjs/go/main/App";
import { EventsOn } from "../wailsjs/runtime/runtime";

type DrawerType = 'none' | 'settings' | 'profiles' | 'logs';

const SettingsItem = ({ label, children }: { label: string, children: React.ReactNode }) => (
    <div className="flex justify-between items-center py-2">
        <span className="text-xs font-bold text-gray-400">{label}</span>
        {children}
    </div>
);

const SwitchRow = ({ label, sub, active, color, icon, onClick }: any) => (
    <div onClick={onClick} className="flex items-center justify-between cursor-pointer group select-none py-1">
        <div className="flex items-center gap-4"> 
            <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-sm transition-all duration-500 ${active ? (color==='blue' ? 'bg-blue-600 text-white shadow-[0_0_20px_2px_rgba(37,99,235,0.6)]' : 'bg-purple-600 text-white shadow-[0_0_20px_2px_rgba(147,51,234,0.6)]') : 'bg-[#1a1a1a] text-[#444] group-hover:text-[#666] group-hover:bg-[#222]'}`}><i className={`fas ${icon}`}></i></div>
            <div className="flex flex-col min-w-0"><div className={`text-xs font-bold tracking-wide transition-colors duration-300 whitespace-nowrap ${active ? 'text-white' : 'text-[#555] group-hover:text-gray-400'}`}>{label}</div><div className="text-[9px] text-[#444] whitespace-nowrap group-hover:text-[#555] transition-colors">{sub}</div></div>
        </div>
        <div className={`w-11 h-6 shrink-0 rounded-full transition-colors duration-300 relative ${active ? (color==='blue'?'bg-blue-600':'bg-purple-600') : 'bg-[#222] group-hover:bg-[#2a2a2a]'}`}><div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-md ${active ? 'translate-x-5' : 'translate-x-0'}`}></div></div>
    </div>
);

function App() {
    const [running, setRunning] = useState(false);
    const [coreExists, setCoreExists] = useState(true);
    const [msg, setMsg] = useState("READY");
    const [activeDrawer, setActiveDrawer] = useState<DrawerType>('none');
    
    const [tunMode, setTunMode] = useState(false);
    const [sysProxy, setSysProxy] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    
    const [copyState, setCopyState] = useState("COPY");
    const [errorLog, setErrorLog] = useState(""); 
    const [localVer, setLocalVer] = useState("Unknown");
    const [remoteVer, setRemoteVer] = useState("Unknown");
    const [mirrorUrl, setMirrorUrl] = useState("");
    const [mirrorEnabled, setMirrorEnabled] = useState(false);
    const [updateState, setUpdateState] = useState("idle");
    const [downloadProgress, setDownloadProgress] = useState(0);

    const [startOnBoot, setStartOnBoot] = useState(false);
    const [autoConnect, setAutoConnect] = useState(false);
    const [autoConnectMode, setAutoConnectMode] = useState("full");

    const [profiles, setProfiles] = useState<any[]>([]);
    const [activeProfile, setActiveProfile] = useState<any>(null);
    const [newName, setNewName] = useState("");
    const [newUrl, setNewUrl] = useState("");
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

    const [showEditor, setShowEditor] = useState(false);
    const [editingType, setEditingType] = useState<"tun" | "mixed" | "mirror">("tun");
    const [editorContent, setEditorContent] = useState("");
    const [saveBtnText, setSaveBtnText] = useState("SAVE");

    const cleanLog = (text: string) => text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
    const copyLog = () => { navigator.clipboard.writeText(errorLog); setCopyState("COPIED!"); setTimeout(() => setCopyState("COPY"), 2000); };

    useEffect(() => {
        refreshData();
        const unsubStatus = EventsOn("status", (state: boolean) => setRunning(state));
        const unsubLog = EventsOn("log", (logMsg: string) => {
            const cleaned = cleanLog(logMsg);
            const ignoreKeywords = ["forcibly closed", "connection upload closed", "raw-read tcp", "use of closed network connection", "context canceled"];
            if (ignoreKeywords.some(k => cleaned.includes(k))) return;
            if (cleaned.includes("ERROR") || cleaned.includes("FATAL") || cleaned.includes("bind: address already in use") || cleaned.includes("Access is denied")) {
                setMsg("ERROR"); setRunning(false); setErrorLog(cleaned); 
            } else { setMsg(cleaned); }
        });
        const unsubProgress = EventsOn("download-progress", (pct: number) => {
            setDownloadProgress(pct);
        });
        return () => { unsubStatus(); unsubLog(); unsubProgress(); };
    }, []);

    const refreshData = async () => {
        const data = await Backend.GetInitData();
        setRunning(data.running);
        setProfiles(data.profiles || []);
        setActiveProfile(data.activeProfile || null);
        setCoreExists(data.coreExists);
        if (!data.coreExists) setMsg("Kernel Missing");
        setLocalVer(data.localVersion);
        setMirrorUrl(data.mirror);
        setMirrorEnabled(data.mirrorEnabled);
        setTunMode(data.tunMode);
        setSysProxy(data.sysProxy);
        setStartOnBoot(data.startOnBoot);
        setAutoConnect(data.autoConnect);
        setAutoConnectMode(data.autoConnectMode);
    };

    const handleToggle = async (target: 'tun' | 'proxy') => {
        if (isProcessing) return;
        if (!coreExists) { setMsg("KERNEL MISSING!"); setActiveDrawer('settings'); return; }
        setIsProcessing(true);
        let newTun = tunMode;
        let newProxy = sysProxy;
        if (target === 'tun') newTun = !tunMode;
        if (target === 'proxy') newProxy = !sysProxy;
        setTunMode(newTun); setSysProxy(newProxy); setMsg(newTun || newProxy ? "STARTING..." : "STOPPING...");
        const res = await Backend.ApplyState(newTun, newProxy);
        setIsProcessing(false);
        if (res === "Success" || res === "Stopped") {
            setMsg(newTun || newProxy ? "RUNNING" : "STOPPED");
            if (!newTun && !newProxy) setRunning(false); else setRunning(true);
        } else {
            setMsg("ERROR"); setErrorLog(res); setTunMode(tunMode); setSysProxy(sysProxy);
        }
    };

    const handleMirrorToggle = async () => {
        const newState = !mirrorEnabled;
        setMirrorEnabled(newState);
        await Backend.SaveSettings(mirrorUrl, newState);
    };

    const handleStartOnBootToggle = async () => {
        const newState = !startOnBoot;
        const res = await Backend.SetStartOnBoot(newState);
        if (res === "Success") {
            setStartOnBoot(newState);
            if (newState && !autoConnect) {
                const resAuto = await Backend.SetAutoConnect(true, autoConnectMode);
                if (resAuto === "Success") setAutoConnect(true);
            }
        }
        else alert(res);
    };

    const handleAutoConnectToggle = async () => {
        const newState = !autoConnect;
        const res = await Backend.SetAutoConnect(newState, autoConnectMode);
        if (res === "Success") setAutoConnect(newState);
        else alert(res);
    };

    const handleAutoConnectModeChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newMode = e.target.value;
        const res = await Backend.SetAutoConnect(autoConnect, newMode);
        if (res === "Success") setAutoConnectMode(newMode);
    };

    const openEditor = async (type: "tun" | "mixed" | "mirror") => {
        setEditingType(type);
        setSaveBtnText("SAVE");
        if (type === 'mirror') {
            setEditorContent(mirrorUrl);
        } else {
            const content = await Backend.GetOverride(type);
            try {
                const obj = JSON.parse(content);
                setEditorContent(JSON.stringify(obj, null, 2));
            } catch {
                setEditorContent(content);
            }
        }
        setShowEditor(true);
    };

    const saveEditor = async () => {
        let res = "";
        if (editingType === 'mirror') {
            res = await Backend.SaveSettings(editorContent, mirrorEnabled);
            if (res === "Success") {
                setMirrorUrl(editorContent);
            }
        } else {
            res = await Backend.SaveOverride(editingType as string, editorContent);
        }

        if (res === "Success") {
            setSaveBtnText("SAVED");
            if (running && editingType !== 'mirror') setMsg("RESTART TO APPLY");
            setTimeout(() => {
                setShowEditor(false);
            }, 800);
        } else {
            alert(res);
        }
    };

    const resetEditor = async () => {
        if(confirm("Reset to default?")) {
            if (editingType === 'mirror') {
                setEditorContent("https://gh-proxy.com/");
            } else {
                const res = await Backend.ResetOverride(editingType);
                try {
                    const obj = JSON.parse(res === "Success" ? await Backend.GetOverride(editingType) : "{}");
                    setEditorContent(JSON.stringify(obj, null, 2));
                } catch {
                    setEditorContent("Error");
                }
            }
        }
    };

    const checkUpdate = async () => { setUpdateState("checking"); const ver = await Backend.CheckUpdate(); if (ver.includes("Error") || ver.includes("Failed") || ver.includes("No tag")) { setMsg("Check Failed"); setErrorLog(ver); setUpdateState("idle"); return; } setRemoteVer(ver); setUpdateState(ver.replace("v","") !== localVer.replace("v","") ? "available" : "latest"); };
    
    const performUpdate = async () => { 
        setUpdateState("updating"); 
        setMsg("Init Download..."); 
        const effectiveMirror = mirrorEnabled ? mirrorUrl : "";
        const res = await Backend.UpdateKernel(effectiveMirror); 
        if (res === "Success") { 
            setCoreExists(true); 
            setMsg("Updated!"); 
            setLocalVer(remoteVer.replace("v","")); 
            setUpdateState("success"); 
            setTimeout(()=>setUpdateState("idle"),2000); 
        } else { 
            setMsg("Failed"); 
            setErrorLog(cleanLog(res)); 
            setUpdateState("error"); 
        } 
    };

    const addProfile = async () => { if(!newName||!newUrl)return setMsg("Input missing"); setMsg("Downloading..."); const res = await Backend.AddProfile(newName, newUrl); if(res==="Success"){setMsg("Success");setNewName("");setNewUrl("");refreshData()}else{setMsg("Error");setErrorLog(cleanLog(res))} };
    const switchProfile = async (id: string) => { const res = await Backend.SelectProfile(id); if(res==="Success"){setMsg("Switched");refreshData()}else{setMsg("Error");setErrorLog(cleanLog(res))} };
    const deleteProfile = async (id: string, e: any) => { e.stopPropagation(); if(confirm("Delete?")) { await Backend.DeleteProfile(id); refreshData(); } };
    const updateActive = async () => { if (isUpdatingProfile) return; setIsUpdatingProfile(true); setMsg("Updating..."); const res = await Backend.UpdateActiveProfile(); setIsUpdatingProfile(false); if(res !== "Success") { setMsg("Error"); setErrorLog(cleanLog(res)); } else { setMsg("Updated"); refreshData(); } };
    const minimize = () => Backend.Minimize();
    const minimizeToTray = () => Backend.MinimizeToTray();
    const quitApp = () => Backend.Quit();
    
    const getStatusText = () => { if (!coreExists) return "MISSING"; if (msg === "ERROR") return "ERROR"; if (!running) return "OFFLINE"; if (tunMode && sysProxy) return "FULL MODE"; if (tunMode) return "TUN MODE"; if (sysProxy) return "PROXY MODE"; return "ONLINE"; };
    const getStatusGlow = () => { if (!coreExists || msg === "ERROR") return "text-red-500 drop-shadow-[0_0_25px_rgba(220,38,38,0.8)]"; if (!running) return "text-[#333] drop-shadow-none"; if (tunMode && sysProxy) return "text-white drop-shadow-[0_0_35px_rgba(147,51,234,0.8)]"; if (tunMode) return "text-white drop-shadow-[0_0_35px_rgba(37,99,235,0.8)]"; if (sysProxy) return "text-white drop-shadow-[0_0_35px_rgba(168,85,247,0.8)]"; return "text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.5)]"; };
    const getControlBg = () => { if (tunMode && sysProxy) return "bg-gradient-to-br from-blue-600/40 via-purple-600/40 to-blue-900/40"; if (tunMode) return "bg-blue-600/20"; if (sysProxy) return "bg-purple-600/20"; return "bg-transparent"; };
    const btnBase = "transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) active:scale-95 flex items-center justify-center";
    const btnGlow = "hover:bg-[#222] hover:border-[#444] hover:shadow-[0_0_20px_rgba(255,255,255,0.08)] hover:text-white";
    const btnRedGlow = "hover:border-red-900/50 hover:text-red-500 hover:bg-red-900/10 hover:shadow-[0_0_20px_rgba(220,38,38,0.2)]";
    const btnBlueGlow = "hover:bg-blue-500 hover:shadow-[0_0_30px_rgba(37,99,235,0.4)] text-white";

    const renderKernelUpdateBtn = () => {
        const baseStyle = `text-[10px] font-bold px-3 py-1.5 rounded-lg border ${btnBase}`;
        switch(updateState) {
            case 'checking': 
                return <button disabled className={`${baseStyle} border-blue-500/30 text-blue-400 bg-[#1a1a1a] cursor-wait`}><i className="fas fa-circle-notch fa-spin mr-1"></i> CHECKING</button>;
            case 'available':
                return <button onClick={performUpdate} className={`${baseStyle} border-blue-600 bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_10px_rgba(37,99,235,0.4)] animate-pulse`}>UP TO {remoteVer}</button>;
            case 'updating':
                return <button disabled className={`${baseStyle} border-blue-500/30 text-white bg-[#1a1a1a] relative overflow-hidden`}><div className="absolute inset-0 bg-blue-600/30 transition-all duration-300" style={{width: `${downloadProgress}%`}}></div><span className="relative z-10">DL {downloadProgress}%</span></button>;
            case 'success':
                return <button disabled className={`${baseStyle} border-emerald-500/50 text-emerald-400 bg-emerald-500/10`}>UPDATED</button>;
            case 'latest':
                return <button disabled className={`${baseStyle} border-emerald-500/20 text-emerald-600 bg-[#1a1a1a]`}>LATEST</button>;
            default:
                return <button onClick={checkUpdate} className={`${baseStyle} border-[#333] text-gray-300 bg-[#1a1a1a] ${btnGlow} ${!coreExists && "border-yellow-600 text-yellow-500"}`}>CHECK</button>;
        }
    };

    const isDrawerOpen = activeDrawer !== 'none';

    return (
        <div className="h-screen w-screen relative bg-[#090909] text-white select-none border border-[#222] rounded-xl overflow-hidden font-sans flex flex-col shadow-2xl">
            <div className="h-10 shrink-0 flex justify-between items-center px-4 bg-[#090909] z-70 relative border-b border-[#1a1a1a]" style={{"--wails-draggable": "drag"} as any}><div className="text-[10px] font-bold tracking-[0.2em] text-[#666] flex items-center gap-2"><div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentcolor] ${coreExists ? "bg-emerald-500 text-emerald-500" : "bg-red-500 text-red-500"}`}></div> WINBOX</div>
            <div className="flex gap-2" style={{"--wails-draggable": "no-drag"} as any}><button onClick={minimize} className={`text-[#666] p-1 w-8 h-8 rounded-xl ${btnBase} hover:bg-white/10 hover:text-white`}><i className="fas fa-minus text-sm"></i></button><button onClick={minimizeToTray} className={`text-[#666] p-1 w-8 h-8 rounded-xl ${btnBase} hover:bg-white/10 hover:text-white`}><i className="fas fa-angle-down text-sm"></i></button></div></div>
            <div className={`absolute inset-0 pt-16 px-6 pb-8 flex flex-col justify-between items-center transition-all duration-500 ${isDrawerOpen ? 'scale-95 opacity-50 blur-[2px]' : 'scale-100 opacity-100'}`}>
                <div className="w-full pt-4"><div className="text-[9px] font-bold text-[#444] mb-2 tracking-widest uppercase ml-1">Active Configuration</div><div onClick={() => setActiveDrawer('profiles')} className={`w-full bg-[#131313] border border-[#222] rounded-2xl p-4 cursor-pointer group relative overflow-hidden h-20 flex items-center ${btnBase} hover:border-[#333] hover:shadow-[0_0_20px_rgba(255,255,255,0.03)]`}><div className="flex justify-between items-center w-full z-10 relative"><div className="overflow-hidden mr-4"><div className="text-sm font-bold text-white mb-1 truncate">{activeProfile ? activeProfile.name : "Select Profile"}</div><div className="text-[10px] text-[#555] font-mono truncate group-hover:text-[#777] transition-colors">{activeProfile && activeProfile.updated ? `Updated: ${activeProfile.updated}` : "Tap to select"}</div></div><div className="text-[#333] group-hover:text-blue-500 transition-colors duration-300"><i className="fas fa-chevron-down text-xs"></i></div></div>{running && <div className="absolute inset-0 bg-blue-500/5 animate-pulse pointer-events-none"></div>}</div></div>
                <div className="w-full flex-1 flex flex-col justify-center relative"><div className={`w-full bg-[#111] border border-[#222] rounded-4xl p-8 flex flex-col gap-6 relative overflow-hidden transition-all duration-500 ${isProcessing ? 'opacity-80 pointer-events-none grayscale' : 'opacity-100'}`}><div className={`absolute inset-0 blur-[60px] opacity-40 pointer-events-none transition-all duration-1000 ${getControlBg()}`}></div><div className="text-center z-10 cursor-pointer" onClick={() => {if(msg==="ERROR" || errorLog) setActiveDrawer('logs')}}><div className={`text-4xl font-black tracking-tighter transition-all duration-500 whitespace-nowrap ${getStatusGlow()}`}>{getStatusText()}</div><div className="text-[9px] text-[#444] group-hover:text-[#666] font-mono uppercase tracking-widest mt-2 h-3 transition-colors">{msg === "ERROR" ? "VIEW ERROR LOGS" : msg}</div></div><div className="h-px bg-[#222]/80 z-10 mx-auto w-[90%]"></div><div className="flex flex-col gap-6 z-10 px-1"><SwitchRow label="TUN MODE" sub="Virtual Network Interface" active={tunMode} color="blue" icon="fa-shield-alt" onClick={() => handleToggle('tun')} /><SwitchRow label="SYSTEM PROXY" sub="Global HTTP Proxy" active={sysProxy} color="purple" icon="fa-globe" onClick={() => handleToggle('proxy')} /></div></div></div>
                <div className="w-full flex gap-3 z-10 pt-4"><button onClick={Backend.OpenDashboard} disabled={!running} className={`flex-1 py-3 rounded-xl text-xs font-bold tracking-wide border border-transparent ${btnBase} ${running ? `bg-blue-600 text-white ${btnBlueGlow}` : "bg-[#1a1a1a] text-[#444] border-[#222] cursor-not-allowed"}`}>DASHBOARD</button><button onClick={() => setActiveDrawer('logs')} className={`w-12 rounded-xl border bg-[#1a1a1a] text-[#666] ${btnBase} ${msg === "ERROR" ? "border-red-500 text-red-500 bg-red-900/10 shadow-[0_0_15px_rgba(220,38,38,0.3)]" : btnGlow}`}> <i className="fas fa-file-lines"></i></button><button onClick={() => setActiveDrawer('settings')} className={`w-12 rounded-xl border border-[#222] bg-[#1a1a1a] text-[#666] ${btnBase} ${btnGlow}`}><i className="fas fa-cog"></i></button><button onClick={quitApp} className={`w-12 rounded-xl border border-[#222] bg-[#1a1a1a] text-[#666] ${btnBase} ${btnRedGlow}`}><i className="fas fa-power-off"></i></button></div>
            </div>

            <div className={`absolute inset-x-0 top-10 bottom-0 z-40 bg-[#090909]/95 backdrop-blur-3xl flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${activeDrawer === 'settings' ? 'translate-y-0' : 'translate-y-full'}`}>
                <div className="h-10 shrink-0 flex justify-between items-center px-6 border-b border-[#222]"><h2 className="text-xs font-bold text-[#666] uppercase tracking-widest">System Settings</h2><button onClick={() => setActiveDrawer('none')} className={`text-[10px] font-bold text-blue-500 bg-blue-500/10 px-3 py-1.5 rounded-xl ${btnBase} hover:bg-blue-500/20 hover:shadow-[0_0_10px_rgba(37,99,235,0.2)]`}>DONE</button></div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar [&::-webkit-scrollbar]:hidden">
                    <div className="bg-[#131313] p-5 rounded-xl border border-[#222] space-y-3 shadow-lg">
                        <SettingsItem label="Local Kernel">
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-500 font-mono">{localVer}</span>
                                {renderKernelUpdateBtn()}
                            </div>
                        </SettingsItem>
                        
                        <SettingsItem label="GitHub Mirror">
                            <div className="flex items-center gap-2">
                                <button onClick={() => openEditor('mirror')} className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${btnBase} border-[#333] text-gray-300 bg-[#1a1a1a] ${btnGlow}`}>EDIT</button>
                                <div onClick={handleMirrorToggle} className={`w-8 h-4 rounded-full p-0.5 cursor-pointer transition-colors duration-300 ${mirrorEnabled ? 'bg-blue-600' : 'bg-[#333]'}`}>
                                    <div className={`w-3 h-3 bg-white rounded-full transition-transform duration-300 ${mirrorEnabled ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                </div>
                            </div>
                        </SettingsItem>

                        <SettingsItem label="Start With Windows">
                            <div onClick={handleStartOnBootToggle} className={`w-8 h-4 rounded-full p-0.5 cursor-pointer transition-colors duration-300 ${startOnBoot ? 'bg-blue-600' : 'bg-[#333]'}`}>
                                <div className={`w-3 h-3 bg-white rounded-full transition-transform duration-300 ${startOnBoot ? 'translate-x-4' : 'translate-x-0'}`}></div>
                            </div>
                        </SettingsItem>

                        <SettingsItem label="Auto Connect">
                            <div onClick={handleAutoConnectToggle} className={`w-8 h-4 rounded-full p-0.5 cursor-pointer transition-colors duration-300 ${autoConnect ? 'bg-blue-600' : 'bg-[#333]'}`}>
                                <div className={`w-3 h-3 bg-white rounded-full transition-transform duration-300 ${autoConnect ? 'translate-x-4' : 'translate-x-0'}`}></div>
                            </div>
                        </SettingsItem>

                        {autoConnect && (
                            <div className="flex justify-between items-center py-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                <span className="text-xs font-bold text-gray-400 pl-4 border-l-2 border-[#333]">Startup Mode</span>
                                <select 
                                    value={autoConnectMode}
                                    onChange={handleAutoConnectModeChange}
                                    className="bg-[#1a1a1a] text-xs text-gray-300 border border-[#333] rounded-lg px-2 py-1 outline-none focus:border-blue-500/50 appearance-none text-center font-bold w-24 cursor-pointer"
                                >
                                    <option value="full">FULL</option>
                                    <option value="tun">TUN</option>
                                    <option value="proxy">PROXY</option>
                                </select>
                            </div>
                        )}

                        <div className="h-px bg-[#222] my-2"></div>
                        
                        <SettingsItem label="TUN Config">
                             <button onClick={() => openEditor('tun')} className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border ${btnBase} border-[#333] text-gray-300 bg-[#1a1a1a] ${btnGlow}`}>EDIT</button>
                        </SettingsItem>
                        <SettingsItem label="Mixed Config">
                             <button onClick={() => openEditor('mixed')} className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border ${btnBase} border-[#333] text-gray-300 bg-[#1a1a1a] ${btnGlow}`}>EDIT</button>
                        </SettingsItem>
                    </div>
                </div>
            </div>

            <div className={`absolute inset-0 z-80 bg-black/60 backdrop-blur-sm flex items-center justify-center transition-opacity duration-300 ${showEditor ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                <div className={`w-[90%] h-[70%] bg-[#111] border border-[#333] rounded-2xl shadow-2xl flex flex-col overflow-hidden transform transition-all duration-300 ${showEditor ? 'scale-100' : 'scale-95'}`}>
                    <div className="h-10 shrink-0 flex justify-between items-center px-4 border-b border-[#222] bg-[#090909]">
                        <h2 className="text-xs font-bold text-[#666] uppercase tracking-widest">EDIT {editingType.toUpperCase()}</h2>
                        <div className="flex gap-2">
                            <button onClick={resetEditor} className={`text-[10px] text-yellow-500 px-3 py-1.5 rounded-xl hover:bg-yellow-500/10 ${btnBase}`}>RESET</button>
                            <button onClick={() => setShowEditor(false)} className={`text-[10px] text-[#666] px-3 py-1.5 rounded-xl hover:text-white ${btnBase}`}>CANCEL</button>
                            <button onClick={saveEditor} className={`text-[10px] font-bold px-3 py-1.5 rounded-xl ${btnBase} ${saveBtnText === "SAVED" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50" : "text-blue-500 bg-blue-500/10 hover:bg-blue-500/20 shadow-[0_0_10px_rgba(37,99,235,0.2)]"}`}>{saveBtnText}</button>
                        </div>
                    </div>
                    <div className="flex-1 p-4 bg-[#050505] relative">
                        <textarea 
                            value={editorContent} 
                            onChange={e => setEditorContent(e.target.value)} 
                            className="w-full h-full bg-transparent text-xs font-mono text-gray-300 focus:outline-none resize-none custom-scrollbar"
                            spellCheck="false"
                        />
                    </div>
                </div>
            </div>

            <div className={`absolute inset-x-0 top-10 bottom-0 z-40 bg-[#090909]/95 backdrop-blur-3xl flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${activeDrawer === 'profiles' ? 'translate-y-0' : '-translate-y-full'}`}><div className="h-10 shrink-0 flex justify-between items-center px-6 border-b border-[#222]"><h2 className="text-xs font-bold text-[#666] uppercase tracking-widest">Profiles Manager</h2><button onClick={() => setActiveDrawer('none')} className={`text-[10px] font-bold text-blue-500 bg-blue-500/10 px-3 py-1.5 rounded-xl ${btnBase} hover:bg-blue-500/20 hover:shadow-[0_0_15px_rgba(37,99,235,0.3)]`}>DONE</button></div><div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar [&::-webkit-scrollbar]:hidden"><div className="bg-[#131313] p-4 rounded-2xl border border-[#222] flex flex-col gap-3 shadow-[0_0_30px_rgba(0,0,0,0.3)]"><div className="flex justify-between items-center"><span className="text-xs font-bold text-gray-400">Current Profile</span><span className="text-[10px] text-blue-400 font-mono truncate max-w-37.5">{activeProfile ? activeProfile.name : "None"}</span></div><div className="flex justify-between items-center border-t border-[#222] pt-2"><span className="text-[9px] text-[#555]">LAST UPDATED</span><span className="text-[9px] text-gray-300 font-mono">{activeProfile && activeProfile.updated ? activeProfile.updated : "Never"}</span></div><button onClick={updateActive} disabled={!activeProfile || isUpdatingProfile} className={`w-full py-2.5 rounded-xl text-xs font-bold border ${btnBase} ${isUpdatingProfile ? "bg-blue-600/20 text-blue-400 border-blue-500/50 cursor-wait" : `bg-[#1a1a1a] border-[#333] text-gray-300 ${btnGlow}`}`}>{isUpdatingProfile ? <><i className="fas fa-circle-notch fa-spin"></i> UPDATING...</> : <><i className="fas fa-sync-alt"></i> UPDATE SUBSCRIPTION</>}</button></div><div><div className="text-[10px] font-bold text-[#444] mb-3 uppercase ml-1">Switch Profile</div><div className="space-y-2">{profiles.map(p => (<div key={p.id} onClick={() => switchProfile(p.id)} className={`flex justify-between items-center p-3 rounded-xl border cursor-pointer ${btnBase} ${activeProfile?.id === p.id ? "bg-blue-900/20 border-blue-500/30 shadow-[0_0_15px_rgba(37,99,235,0.2)]" : `bg-[#131313] border-[#222] ${btnGlow}`}`}><div className="overflow-hidden pr-4"><div className={`text-xs font-bold truncate mb-1 ${activeProfile?.id === p.id ? "text-blue-400" : "text-gray-300"}`}>{p.name}</div><div className="text-[10px] text-[#555] truncate font-mono">{p.url}</div></div><button onClick={(e) => deleteProfile(p.id, e)} className={`text-[#444] px-2 w-8 h-8 rounded-full ${btnBase} hover:text-red-500 hover:bg-red-900/20 hover:shadow-[0_0_10px_rgba(220,38,38,0.3)]`}><i className="fas fa-trash"></i></button></div>))}</div></div><div><div className="text-[10px] font-bold text-[#444] mb-3 uppercase ml-1">Add Profile</div><div className="bg-[#131313] p-4 rounded-2xl border border-[#222] space-y-3 shadow-lg"><input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Name" className="w-full bg-[#090909] border border-[#222] rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-blue-500/50 focus:shadow-[0_0_15px_rgba(37,99,235,0.1)] transition-all"/><input value={newUrl} onChange={e=>setNewUrl(e.target.value)} placeholder="URL" className="w-full bg-[#090909] border border-[#222] rounded-xl px-4 py-3 text-xs text-[#666] focus:outline-none focus:border-blue-500/50 focus:shadow-[0_0_15px_rgba(37,99,235,0.1)] font-mono transition-all"/><button onClick={addProfile} className={`w-full py-3 bg-blue-600 rounded-xl text-xs font-bold ${btnBase} ${btnBlueGlow}`}>ADD NOW</button></div></div><div className="h-6"></div></div></div>
            <div className={`absolute inset-x-0 bottom-0 top-10 z-60 bg-[#090909]/95 backdrop-blur-3xl flex flex-col transition-transform duration-500 ${activeDrawer === 'logs' ? 'translate-y-0' : 'translate-y-full'}`}><div className="h-12 border-b border-[#222] flex items-center justify-between px-6"><h2 className="text-xs font-bold text-[#666] uppercase tracking-widest">LOGS</h2><button onClick={() => setActiveDrawer('none')} className={`text-[10px] bg-[#222] px-3 py-1.5 rounded-xl text-white ${btnBase} hover:bg-[#333] hover:shadow-[0_0_10px_rgba(255,255,255,0.1)]`}>CLOSE</button></div><div className="flex-1 overflow-y-auto p-6 bg-[#050505] custom-scrollbar [&::-webkit-scrollbar]:hidden"><pre className="text-[10px] text-gray-400 font-mono whitespace-pre-wrap break-all">{errorLog || "No logs."}</pre></div><div className="p-4 border-t border-[#222] flex justify-end"><button onClick={copyLog} className={`px-4 py-2 rounded-xl text-[10px] font-bold border ${btnBase} ${copyState === "COPIED!" ? `bg-emerald-500 text-white border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]` : `bg-[#1a1a1a] text-gray-300 border-[#222] ${btnGlow}`}`}>{copyState}</button></div></div>
        </div>
    );
}

export default App;