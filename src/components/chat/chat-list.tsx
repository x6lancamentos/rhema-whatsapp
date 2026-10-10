"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MessageSquarePlus, Search, MessageCircle, X, Tag, MoreHorizontal, CornerUpLeft, CornerDownLeft, Trash2, Info, Check, Shield, Users, User, Bookmark, ListFilter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getChatsStatus } from "@/app/dashboard/chat/actions";
import { useSocket } from "./socket-context";
import { toast } from "sonner";

import { formatPhone } from "@/lib/phone-formatter";

interface ChatContact {
    jid: string;
    name: string | null;
    notify: string | null;
    profilePic: string | null;
    lastMessage?: {
        content: string | null;
        timestamp: string;
        type: string;
        fromMe?: boolean;
    };
}

interface LabelData {
    id: string;
    name: string;
    colorHex: string;
}

interface ChatListProps {
    sessionId: string;
    onSelectChat: (jid: string, name?: string) => void;
    selectedJid?: string;
    userRole?: string;
}

const PAGE_SIZE = parseInt(process.env.NEXT_PUBLIC_CHAT_PAGE_SIZE || "50", 10);

function getDisplayName(chat: ChatContact): string {
    if (chat.name && chat.name.trim().length > 0 && !chat.name.match(/^\+?\d{8,}$/)) {
        return chat.name.trim();
    }
    if (chat.notify && chat.notify.trim().length > 0 && !chat.notify.match(/^\+?\d{8,}$/)) {
        return chat.notify.trim();
    }
    return formatPhone(chat.jid);
}

function getMessagePreview(chat: ChatContact): string {
    if (!chat.lastMessage?.content && !chat.lastMessage?.type) return "Nenhuma mensagem";
    const type = (chat.lastMessage?.type || "TEXT").toUpperCase();
    const content = chat.lastMessage?.content || "";
    const prefix = chat.lastMessage?.fromMe ? "Você: " : "";

    switch (type) {
        case "AUDIO":
            return `${prefix}🎤 Mensagem de voz`;
        case "IMAGE":
            return `${prefix}📷 ${content || "Foto"}`;
        case "VIDEO":
            return `${prefix}🎥 ${content || "Vídeo"}`;
        case "STICKER":
            return `${prefix}💟 Figurinha`;
        case "LOCATION":
            return `${prefix}📍 Localização`;
        case "CONTACT":
            return `${prefix}👤 Contato: ${content || "Compartilhado"}`;
        case "DOCUMENT":
            return `${prefix}📄 ${content || "Documento"}`;
        default:
            const short = content.length > 40 ? content.slice(0, 40) + "…" : content;
            return `${prefix}${short}`;
    }
}

function getTimeLabel(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return "Ontem";
    if (diffDays < 7) return date.toLocaleDateString("pt-BR", { weekday: 'short' });
    return date.toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' });
}

// ─── Label Assignment Popover ──────
function LabelAssignPopover({ sessionId, jid, children }: { sessionId: string; jid: string; children: React.ReactNode }) {
    const [labels, setLabels] = useState<LabelData[]>([]);
    const [assigned, setAssigned] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const openRef = useRef(false);

    const fetchLabels = useCallback(async () => {
        setLoading(true);
        try {
            const [labelRes, assignedRes] = await Promise.all([
                fetch(`/api/labels/${sessionId}`),
                fetch(`/api/labels/${sessionId}/chats?jid=${encodeURIComponent(jid)}`)
            ]);
            const labelData = await labelRes.json();
            const assignedData = await assignedRes.json();

            if (labelRes.ok) setLabels(labelData.data?.labels || []);
            if (assignedRes.ok) {
                setAssigned(new Set((assignedData.data || []).map((cl: any) => cl.labelId)));
            }
        } catch (e) {
            console.error("Failed to fetch labels", e);
        } finally {
            setLoading(false);
        }
    }, [sessionId, jid]);

    useEffect(() => {
        if (openRef.current) fetchLabels();
    }, [fetchLabels]);

    const toggleLabel = async (labelId: string) => {
        const isAssigned = assigned.has(labelId);
        try {
            const res = await fetch(`/api/labels/${sessionId}/chat/${encodeURIComponent(jid)}/labels`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ labelIds: [labelId], action: isAssigned ? "remove" : "add" })
            });
            if (res.ok) {
                setAssigned(prev => {
                    const next = new Set(prev);
                    isAssigned ? next.delete(labelId) : next.add(labelId);
                    return next;
                });
                toast.success(isAssigned ? "Label removed" : "Label assigned");
            }
        } catch (e) {
            toast.error("Failed to update label");
        }
    };

    return (
        <Popover onOpenChange={(open) => { openRef.current = open; if (open) fetchLabels(); }}>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent className="w-56 p-1.5" side="right" align="start">
                <div className="text-xs font-semibold text-muted-foreground px-2 py-1.5">Assign labels</div>
                {loading ? (
                    <div className="flex items-center justify-center py-4"><Skeleton className="h-4 w-24" /></div>
                ) : labels.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-2 py-2">No labels. Create one in Labels page.</p>
                ) : (
                    <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
                        {labels.map(label => (
                            <button key={label.id} onClick={() => toggleLabel(label.id)}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm hover:bg-muted transition-colors cursor-pointer text-left">
                                <div className={cn(
                                    "h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                                    assigned.has(label.id) ? "border-foreground" : "border-muted-foreground/30"
                                )}>
                                    {assigned.has(label.id) && <Check className="h-2.5 w-2.5" />}
                                </div>
                                <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: label.colorHex }} />
                                <span className="truncate text-xs font-medium">{label.name}</span>
                            </button>
                        ))}
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}

// ─── Context Menu ──────────────────
interface CtxMenuState { x: number; y: number; jid: string; name: string; }
function ChatContextMenu({ state, onClose, sessionId, onSelect }: { state: CtxMenuState; onClose: () => void; sessionId: string; onSelect: (jid: string, name?: string) => void }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, [onClose]);

    const items = [
        { label: "Open chat", icon: MessageCircle, action: () => { onSelect(state.jid, state.name); onClose(); } },
        { label: "Copy JID", icon: Info, action: () => { navigator.clipboard.writeText(state.jid).then(() => toast.success("JID copied!")); onClose(); } },
    ];

    const style: React.CSSProperties = { position: "fixed", top: state.y, left: state.x, zIndex: 9999 };
    if (state.x > window.innerWidth - 180) style.left = state.x - 180;
    if (state.y > window.innerHeight - 120) style.top = state.y - 120;

    return (
        <div ref={ref} style={style} className="w-44 rounded-xl bg-popover border shadow-xl py-1 animate-in fade-in zoom-in-95 origin-top-left">
            {items.map((item, i) => (
                <button key={i} onClick={item.action} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors cursor-pointer text-foreground hover:bg-muted">
                    <item.icon className="h-3.5 w-3.5 shrink-0" />
                    {item.label}
                </button>
            ))}
        </div>
    );
}

// ─── Chat Row ──────────────────────
function ChatRow({
    chat, isSelected, onSelect, sessionId, labelDots
}: {
    chat: ChatContact; isSelected: boolean; onSelect: (jid: string, name?: string) => void; sessionId: string;
    labelDots: { colorHex: string; labelId?: string; labelName?: string }[];
}) {
    const displayName = getDisplayName(chat);
    const isGroup = chat.jid.endsWith('@g.us');
    const isUnanswered = Boolean(chat.lastMessage && chat.lastMessage.fromMe === false);
    const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null);

    return (
        <>
            {ctxMenu && (
                <ChatContextMenu state={ctxMenu} onClose={() => setCtxMenu(null)} sessionId={sessionId} onSelect={onSelect} />
            )}
            <div
                className={cn(
                    "relative w-full flex items-center gap-3 px-3 py-2.5 transition-colors duration-150 border-b border-border/10 group overflow-hidden cursor-pointer",
                    isSelected
                        ? "bg-primary/8 border-l-2 border-l-primary"
                        : "hover:bg-muted/40 border-l-2 border-l-transparent"
                )}
                onClick={() => onSelect(chat.jid, displayName)}
                onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, jid: chat.jid, name: displayName }); }}
            >
                <div className="relative shrink-0">
                    <Avatar className="h-10 w-10">
                        <AvatarImage src={chat.profilePic || ""} />
                        <AvatarFallback className={cn(
                            "text-xs font-medium",
                            isGroup 
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : "bg-gradient-to-br from-primary/20 to-blue-500/20 text-primary"
                        )}>
                            {isGroup ? <Users className="h-4 w-4" /> : displayName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    {isGroup && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-600 border-2 border-background flex items-center justify-center text-[8px] text-white">
                            <Users className="h-2 w-2" />
                        </span>
                    )}
                </div>

                <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex justify-between items-baseline gap-2 overflow-hidden">
                        <h4 className={cn("text-sm truncate flex items-center gap-1.5", isSelected ? "font-semibold text-primary" : "font-medium text-foreground")}>
                            <span className="truncate">{displayName}</span>
                            {/* Label dots — always visible */}
                            {labelDots.length > 0 && (
                                <span className="flex items-center gap-[2px] shrink-0">
                                    {labelDots.map((d, i) => (
                                        <span key={i} className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: d.colorHex }} title={d.labelName || d.colorHex} />
                                    ))}
                                </span>
                            )}
                            {isUnanswered && (
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" title="Mensagem recebida aguardando resposta" />
                            )}
                        </h4>
                        {chat.lastMessage && (
                            <span className="text-[10px] text-muted-foreground flex-shrink-0">{getTimeLabel(chat.lastMessage.timestamp)}</span>
                        )}
                    </div>
                    <p className={cn(
                        "text-xs truncate mt-0.5",
                        isUnanswered ? "text-foreground font-medium" : "text-muted-foreground"
                    )}>
                        {getMessagePreview(chat)}
                    </p>
                </div>

                {/* Label button on hover */}
                <LabelAssignPopover sessionId={sessionId} jid={chat.jid}>
                    <Button variant="ghost" size="icon"
                        className="h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground shrink-0"
                        onClick={(e) => e.stopPropagation()}>
                        <Tag className="h-3.5 w-3.5" />
                    </Button>
                </LabelAssignPopover>
            </div>
        </>
    );
}

function SkeletonRow() {
    return (
        <div className="flex items-center gap-3 px-3 py-2.5">
            <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-40" />
            </div>
        </div>
    );
}

// ─── Main ──────────────────────────
export function ChatList({ sessionId, onSelectChat, selectedJid, userRole }: ChatListProps) {
    const [chats, setChats] = useState<ChatContact[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchInput, setSearchInput] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [isNewChatOpen, setIsNewChatOpen] = useState(false);
    const [newChatNumber, setNewChatNumber] = useState("");
    const [hasMore, setHasMore] = useState(true);
    // Label dots per JID — {colorHex, labelId, labelName}[]
    const [chatLabelMap, setChatLabelMap] = useState<Map<string, {colorHex: string; labelId: string; labelName: string}[]>>(new Map());
    const [availableLabels, setAvailableLabels] = useState<LabelData[]>([]);
    const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);

    // Saved contact lists for filtering
    const [availableLists, setAvailableLists] = useState<{ id: string; name: string; totalCount: number }[]>([]);
    const [selectedListId, setSelectedListId] = useState<string | null>(null);
    const [savedListJids, setSavedListJids] = useState<Set<string>>(new Set());
    const [loadingSavedList, setLoadingSavedList] = useState(false);

    // Categories: all, private, group, unanswered
    const [categoryFilter, setCategoryFilter] = useState<"all" | "private" | "group" | "unanswered">("all");

    // Superadmin Audit Mode state
    const isSuperadmin = userRole === "SUPERADMIN";
    const [viewMode, setViewMode] = useState<"session" | "audit">("session");
    const [auditLeads, setAuditLeads] = useState<any[]>([]);
    const [auditLoading, setAuditLoading] = useState(false);

    const fetchAuditLeads = useCallback(async () => {
        setAuditLoading(true);
        try {
            const res = await fetch(`/api/chat/superadmin/campaign-leads?search=${encodeURIComponent(searchQuery)}`);
            if (res.ok) {
                const data = await res.json();
                setAuditLeads(data.data || []);
            }
        } catch (e) {
            console.error("Failed to fetch audit leads:", e);
        } finally {
            setAuditLoading(false);
        }
    }, [searchQuery]);

    useEffect(() => {
        if (viewMode === "audit") {
            fetchAuditLeads();
        }
    }, [viewMode, fetchAuditLeads]);

    const { getSocket, joinSession } = useSocket();
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const cursorRef = useRef<string | undefined>(undefined);
    const chatsRef = useRef<ChatContact[]>(chats);
    chatsRef.current = chats;
    const fetchingRef = useRef(false);

    const fetchChats = useCallback(async (cursor?: string, append = false) => {
        if (fetchingRef.current) return;
        fetchingRef.current = true;
        try {
            if (!cursor) setLoading(true);
            const rawChats: any = await getChatsStatus(sessionId, PAGE_SIZE, cursor || undefined, searchQuery || undefined);
            
            const processChats = (newChatsList: ChatContact[], existingChatsList: ChatContact[] = []) => {
                const merged = new Map(existingChatsList.map(c => [c.jid, c]));
                (newChatsList || []).forEach((c: any) => {
                    // Ignore broadcast channels and status stories
                    if (c.jid === 'status@broadcast' || c.jid.endsWith('@broadcast') || c.jid.includes('@broadcast')) return;
                    const existing = merged.get(c.jid);
                    if (!existing || (c.lastMessage?.timestamp && (!existing.lastMessage?.timestamp || new Date(c.lastMessage.timestamp) > new Date(existing.lastMessage.timestamp)))) {
                        merged.set(c.jid, c);
                    }
                });
                return Array.from(merged.values());
            };

            if (append) {
                setChats(prev => processChats(rawChats, prev));
            } else {
                setChats(processChats(rawChats));
            }
            setHasMore((rawChats || []).length >= PAGE_SIZE);
        } catch (error) {
            console.error("Failed to load chats", error);
        } finally {
            setLoading(false);
            fetchingRef.current = false;
        }
    }, [sessionId, searchQuery]);

    useEffect(() => { setChats([]); setHasMore(true); fetchChats(); }, [fetchChats]);

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;
        const onConnect = () => joinSession(sessionId);
        if (socket.connected) joinSession(sessionId);
        socket.on("connect", onConnect);
        const handler = async (newMessages: any[]) => {
            let needsReload = false;
            setChats(prev => {
                const updated = [...prev];
                newMessages.forEach(msg => {
                    const jid = msg.remoteJid;
                    if (!jid || jid === 'status@broadcast' || jid.endsWith('@broadcast') || jid.includes('@broadcast')) return;
                    const idx = updated.findIndex(c => c.jid === jid);
                    if (idx !== -1) {
                        updated[idx] = { ...updated[idx], lastMessage: { content: msg.content, timestamp: msg.timestamp, type: msg.type, fromMe: msg.fromMe } };
                    } else { needsReload = true; }
                });
                updated.sort((a, b) => {
                    const tA = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : 0;
                    const tB = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : 0;
                    return tB - tA;
                });
                return updated;
            });
            if (needsReload) fetchChats();
        };
        socket.on("message.update", handler);
        return () => { socket.off("connect", onConnect); socket.off("message.update", handler); };
    }, [sessionId, getSocket, joinSession, fetchChats]);

    // Fetch label assignments and available filter options
    useEffect(() => {
        if (!sessionId) return;
        (async () => {
            try {
                // Batch fetch all chat-label assignments
                const res = await fetch(`/api/labels/${sessionId}/chats`);
                if (res.ok) {
                    const data = await res.json();
                    const map = new Map<string, { colorHex: string; labelId: string; labelName: string }[]>();
                    for (const cl of (data.data || [])) {
                        const jid = cl.chatJid;
                        if (!map.has(jid)) map.set(jid, []);
                        map.get(jid)!.push({ colorHex: cl.colorHex, labelId: cl.labelId, labelName: cl.labelName });
                    }
                    setChatLabelMap(map);
                }
            } catch (e) {
                console.error("Failed to load label assignments", e);
            }

            try {
                // Fetch labels for session
                const lRes = await fetch(`/api/labels/${sessionId}`);
                if (lRes.ok) {
                    const lData = await lRes.json();
                    setAvailableLabels(lData.data?.labels || []);
                }
            } catch (e) {
                console.error("Failed to load labels", e);
            }

            try {
                // Fetch saved contact lists
                const listRes = await fetch('/api/contact-lists');
                if (listRes.ok) {
                    const listData = await listRes.json();
                    setAvailableLists(listData.data || []);
                }
            } catch (e) {
                console.error("Failed to load saved lists", e);
            }
        })();
    }, [sessionId]);

    const handleSelectSavedList = async (listId: string) => {
        if (selectedListId === listId) {
            setSelectedListId(null);
            setSavedListJids(new Set());
            return;
        }
        setSelectedListId(listId);
        setLoadingSavedList(true);
        try {
            const res = await fetch(`/api/contact-lists/${listId}`);
            if (res.ok) {
                const data = await res.json();
                const contacts = data.data?.contacts || [];
                const jids = new Set<string>();
                for (const c of contacts) {
                    const phone = (c.phone || "").replace(/\D/g, "");
                    if (phone) {
                        jids.add(phone);
                        jids.add(`${phone}@s.whatsapp.net`);
                        if (!phone.startsWith("55")) {
                            jids.add(`55${phone}`);
                            jids.add(`55${phone}@s.whatsapp.net`);
                        }
                    }
                }
                setSavedListJids(jids);
            }
        } catch (e) {
            console.error("Failed to load contacts of list", e);
        } finally {
            setLoadingSavedList(false);
        }
    };

    const handleSearchChange = (val: string) => {
        setSearchInput(val);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => {
            setSearchQuery(val);
        }, 300);
    };

    const filteredChats = useMemo(() => {
        // ALWAYS exclude status@broadcast or any @broadcast
        let list = chats.filter(c => c.jid !== 'status@broadcast' && !c.jid.endsWith('@broadcast') && !c.jid.includes('@broadcast'));

        // Category filter
        if (categoryFilter === "private") {
            list = list.filter(c => !c.jid.endsWith('@g.us'));
        } else if (categoryFilter === "group") {
            list = list.filter(c => c.jid.endsWith('@g.us'));
        } else if (categoryFilter === "unanswered") {
            list = list.filter(c => c.lastMessage && c.lastMessage.fromMe === false);
        }

        // Label filter
        if (selectedLabelId) {
            list = list.filter(c => {
                const dots = chatLabelMap.get(c.jid) || [];
                return dots.some(d => d.labelId === selectedLabelId);
            });
        }

        // Saved list filter
        if (selectedListId && savedListJids.size > 0) {
            list = list.filter(c => {
                const cleanPhone = c.jid.split('@')[0].replace(/\D/g, '');
                return savedListJids.has(c.jid) || savedListJids.has(cleanPhone);
            });
        }

        // Search text filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(chat => {
                const name = (chat.name || chat.notify || "").toLowerCase();
                const jid = chat.jid.toLowerCase();
                return name.includes(q) || jid.includes(q);
            });
        }

        return list;
    }, [chats, categoryFilter, selectedLabelId, selectedListId, savedListJids, searchQuery, chatLabelMap]);

    const handleEndReached = useCallback(() => {
        if (hasMore && !loading && !searchQuery.trim()) {
            const last = chatsRef.current[chatsRef.current.length - 1];
            const c = last?.lastMessage?.timestamp;
            if (c) fetchChats(c, true);
        }
    }, [hasMore, loading, searchQuery, fetchChats]);

    const itemContent = useCallback(
        (_: number, chat: ChatContact) => <ChatRow key={chat.jid} chat={chat} isSelected={selectedJid === chat.jid} onSelect={onSelectChat} sessionId={sessionId} labelDots={chatLabelMap.get(chat.jid) || []} />,
        [selectedJid, onSelectChat, sessionId, chatLabelMap]
    );

    const handleStartNewChat = () => {
        if (!newChatNumber) return;
        let clean = newChatNumber.replace(/\D/g, '');
        // Se for DDD + Telefone brasileiro (10 ou 11 dígitos), adiciona DDI 55
        if ((clean.length === 10 || clean.length === 11) && !clean.startsWith("55")) {
            clean = "55" + clean;
        }
        onSelectChat(`${clean}@s.whatsapp.net`);
        setIsNewChatOpen(false);
        setNewChatNumber("");
    };

    if (loading && chats.length === 0) {
        return (
            <div className="flex flex-col h-full overflow-hidden">
                <div className="p-3 space-y-3">
                    <Skeleton className="h-9 w-full rounded-lg" />
                    {[1, 2, 3, 4, 5].map(i => <SkeletonRow key={i} />)}
                </div>
            </div>
        );
    }

    const hasActiveFilters = categoryFilter !== "all" || Boolean(selectedLabelId) || Boolean(selectedListId);

    return (
        <div className="flex flex-col h-full overflow-hidden bg-background">
            {/* Header */}
            <div className="shrink-0 px-3 pt-3 pb-2 space-y-2 border-b border-border/10">
                {isSuperadmin && (
                    <div className="flex p-0.5 bg-muted/60 rounded-lg border border-border/30 text-xs font-medium">
                        <button
                            onClick={() => setViewMode("session")}
                            className={cn(
                                "flex-1 py-1 px-2 rounded-md transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer text-xs",
                                viewMode === "session"
                                    ? "bg-background text-foreground font-semibold shadow-xs"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <MessageCircle className="h-3.5 w-3.5" />
                            <span>Meu WhatsApp</span>
                        </button>
                        <button
                            onClick={() => setViewMode("audit")}
                            className={cn(
                                "flex-1 py-1 px-2 rounded-md transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer text-xs",
                                viewMode === "audit"
                                    ? "bg-background text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Shield className="h-3.5 w-3.5 text-emerald-500" />
                            <span>Auditoria Leads</span>
                        </button>
                    </div>
                )}

                <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-base text-foreground">
                        {viewMode === "audit" ? "Leads de Campanhas" : "Conversas"}
                        {viewMode === "audit" ? (
                            auditLeads.length > 0 && <span className="ml-1.5 text-xs font-normal text-muted-foreground">({auditLeads.length})</span>
                        ) : (
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                ({filteredChats.length}{hasActiveFilters && chats.length !== filteredChats.length ? ` de ${chats.length}` : ""})
                            </span>
                        )}
                    </h3>
                    {viewMode === "session" && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg"
                            title="Nova conversa"
                            onClick={() => setIsNewChatOpen(!isNewChatOpen)}>
                            {isNewChatOpen ? <X className="h-4 w-4" /> : <MessageSquarePlus className="h-4 w-4" />}
                        </Button>
                    )}
                </div>

                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input placeholder={viewMode === "audit" ? "Buscar por lead, telefone ou corretor..." : "Buscar conversas..."} value={searchInput}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="h-8 pl-8 text-sm bg-muted/50 border-0 rounded-lg focus-visible:ring-1" />
                </div>

                {/* Filters toolbar for WhatsApp session */}
                {viewMode === "session" && (
                    <div className="flex items-center gap-1 overflow-x-auto pt-0.5 pb-1 text-xs styled-scrollbar">
                        <button
                            onClick={() => { setCategoryFilter("all"); setSelectedLabelId(null); setSelectedListId(null); }}
                            className={cn(
                                "px-2.5 py-1 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer",
                                categoryFilter === "all" && !selectedLabelId && !selectedListId
                                    ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                                    : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                            )}
                        >
                            Todas
                        </button>

                        <button
                            onClick={() => setCategoryFilter(categoryFilter === "private" ? "all" : "private")}
                            className={cn(
                                "px-2.5 py-1 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer flex items-center gap-1",
                                categoryFilter === "private"
                                    ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                                    : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                            )}
                            title="Apenas conversas privadas individuais"
                        >
                            <User className="h-3 w-3" />
                            <span>Privadas</span>
                        </button>

                        <button
                            onClick={() => setCategoryFilter(categoryFilter === "group" ? "all" : "group")}
                            className={cn(
                                "px-2.5 py-1 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer flex items-center gap-1",
                                categoryFilter === "group"
                                    ? "bg-emerald-600 text-white shadow-xs font-semibold"
                                    : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                            )}
                            title="Apenas grupos"
                        >
                            <Users className="h-3 w-3" />
                            <span>Grupos</span>
                        </button>

                        <button
                            onClick={() => setCategoryFilter(categoryFilter === "unanswered" ? "all" : "unanswered")}
                            className={cn(
                                "px-2.5 py-1 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer flex items-center gap-1",
                                categoryFilter === "unanswered"
                                    ? "bg-amber-600 text-white shadow-xs font-semibold"
                                    : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                            )}
                            title="Conversas com mensagens recebidas que ainda não foram respondidas"
                        >
                            <CornerDownLeft className="h-3 w-3" />
                            <span>Não Respondidas</span>
                        </button>

                        {/* Labels Filter Popover */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <button
                                    className={cn(
                                        "px-2.5 py-1 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer flex items-center gap-1",
                                        selectedLabelId
                                            ? "bg-purple-600 text-white shadow-xs font-semibold"
                                            : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                                    )}
                                >
                                    <Tag className="h-3 w-3" />
                                    <span className="max-w-[80px] truncate">
                                        {selectedLabelId 
                                            ? availableLabels.find(l => l.id === selectedLabelId)?.name || "Etiqueta"
                                            : "Etiquetas"}
                                    </span>
                                    {selectedLabelId && (
                                        <X
                                            className="h-3 w-3 ml-0.5 hover:text-red-200"
                                            onClick={(e) => { e.stopPropagation(); setSelectedLabelId(null); }}
                                        />
                                    )}
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-1.5" side="bottom" align="start">
                                <div className="text-xs font-semibold text-muted-foreground px-2 py-1">Filtrar por Etiqueta</div>
                                {availableLabels.length === 0 ? (
                                    <p className="text-xs text-muted-foreground px-2 py-2">Nenhuma etiqueta cadastrada.</p>
                                ) : (
                                    <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
                                        {availableLabels.map(l => (
                                            <button
                                                key={l.id}
                                                onClick={() => setSelectedLabelId(selectedLabelId === l.id ? null : l.id)}
                                                className={cn(
                                                    "flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left",
                                                    selectedLabelId === l.id ? "bg-muted font-bold text-foreground" : "hover:bg-muted/60 text-muted-foreground"
                                                )}
                                            >
                                                <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: l.colorHex }} />
                                                <span className="truncate flex-1">{l.name}</span>
                                                {selectedLabelId === l.id && <Check className="h-3 w-3 text-primary shrink-0" />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </PopoverContent>
                        </Popover>

                        {/* Saved List Filter Popover */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <button
                                    className={cn(
                                        "px-2.5 py-1 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer flex items-center gap-1",
                                        selectedListId
                                            ? "bg-blue-600 text-white shadow-xs font-semibold"
                                            : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                                    )}
                                >
                                    <Bookmark className="h-3 w-3" />
                                    <span className="max-w-[80px] truncate">
                                        {selectedListId 
                                            ? availableLists.find(l => l.id === selectedListId)?.name || "Lista Salva"
                                            : "Lista Salva"}
                                    </span>
                                    {selectedListId && (
                                        <X
                                            className="h-3 w-3 ml-0.5 hover:text-red-200"
                                            onClick={(e) => { e.stopPropagation(); setSelectedListId(null); setSavedListJids(new Set()); }}
                                        />
                                    )}
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-60 p-1.5" side="bottom" align="start">
                                <div className="text-xs font-semibold text-muted-foreground px-2 py-1">Filtrar por Lista Salva</div>
                                {availableLists.length === 0 ? (
                                    <p className="text-xs text-muted-foreground px-2 py-2">Nenhuma lista salva encontrada.</p>
                                ) : (
                                    <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
                                        {availableLists.map(l => (
                                            <button
                                                key={l.id}
                                                onClick={() => handleSelectSavedList(l.id)}
                                                className={cn(
                                                    "flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left",
                                                    selectedListId === l.id ? "bg-muted font-bold text-foreground" : "hover:bg-muted/60 text-muted-foreground"
                                                )}
                                            >
                                                <span className="truncate flex-1">{l.name}</span>
                                                <Badge variant="secondary" className="text-[10px] px-1 py-0">{l.totalCount}</Badge>
                                                {selectedListId === l.id && <Check className="h-3 w-3 text-primary ml-1 shrink-0" />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </PopoverContent>
                        </Popover>
                    </div>
                )}

                {isNewChatOpen && viewMode === "session" && (
                    <div className="p-2.5 bg-muted/30 rounded-lg space-y-2 border border-border/40">
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Número de WhatsApp (com DDD)</Label>
                        <div className="flex gap-1.5">
                            <Input placeholder="(13) 98100-1766 ou 5513..." value={newChatNumber}
                                onChange={(e) => setNewChatNumber(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleStartNewChat()}
                                className="h-8 text-sm" />
                            <Button size="sm" className="h-8 px-3 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleStartNewChat}>Abrir</Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Chat list or Audit list */}
            <div className="flex-1 min-h-0">
                {viewMode === "audit" ? (
                    auditLoading ? (
                        <div className="p-3 space-y-3">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <SkeletonRow key={i} />
                            ))}
                        </div>
                    ) : auditLeads.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                            <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3">
                                <Shield className="h-6 w-6" />
                            </div>
                            <p className="text-sm font-semibold text-foreground">Nenhum Lead de Disparo</p>
                            <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
                                Apenas contatos que receberam disparos de campanhas aparecem na auditoria do gestor.
                            </p>
                        </div>
                    ) : (
                        <div className="h-full overflow-y-auto styled-scrollbar">
                            {auditLeads.map((lead) => (
                                <div
                                    key={lead.jid}
                                    onClick={() => onSelectChat(lead.jid, lead.name)}
                                    className={cn(
                                        "relative w-full flex items-start gap-3 px-3 py-2.5 transition-colors border-b border-border/10 cursor-pointer",
                                        selectedJid === lead.jid
                                            ? "bg-primary/8 border-l-2 border-l-primary"
                                            : "hover:bg-muted/40 border-l-2 border-l-transparent"
                                    )}
                                >
                                    <Avatar className="h-9 w-9 shrink-0 mt-0.5">
                                        <AvatarFallback className="text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                            {lead.name.slice(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-1">
                                            <h4 className={cn("text-xs truncate", selectedJid === lead.jid ? "font-bold text-primary" : "font-semibold text-foreground")}>
                                                {lead.name}
                                            </h4>
                                            <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                                                {getTimeLabel(lead.lastMessage?.timestamp || lead.sentAt)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 truncate max-w-[120px]">
                                                {lead.corretorNome}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground truncate">{lead.campaignName}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate mt-1">
                                            {lead.lastMessage?.content || "Disparo enviado pela imobiliária"}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : filteredChats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                        <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                            <MessageCircle className="h-6 w-6 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {searchQuery
                                ? "Nenhuma conversa encontrada com esta busca"
                                : hasActiveFilters
                                    ? "Nenhuma conversa com os filtros selecionados"
                                    : "Nenhuma conversa encontrada"}
                        </p>
                        {hasActiveFilters && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-3 text-xs font-semibold"
                                onClick={() => { setCategoryFilter("all"); setSelectedLabelId(null); setSelectedListId(null); }}
                            >
                                Limpar filtros
                            </Button>
                        )}
                    </div>
                ) : (
                    <Virtuoso style={{ height: "100%" }} data={filteredChats}
                        computeItemKey={(_: number, chat: ChatContact) => chat.jid} itemContent={itemContent}
                        endReached={handleEndReached} increaseViewportBy={200}
                        components={{ Footer: () => hasMore && !loading ? (
                            <div className="py-4 text-center">
                                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Scroll for more</span>
                            </div>
                        ) : null }} />
                )}
            </div>
        </div>
    );
}
