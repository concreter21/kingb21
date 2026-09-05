import React, { useEffect, useState } from "react";
import { Wifi, WifiOff, CloudUpload, Loader2, CheckCircle2 } from "lucide-react";
import { subscribeConnectivity, flushQueue } from "../../lib/offline";
import { useToast } from "../../hooks/use-toast";

const OfflineIndicator = () => {
  const [state, setState] = useState({ online: true, queued: 0 });
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    return subscribeConnectivity(setState);
  }, []);

  useEffect(() => {
    if (state.online && state.queued > 0 && !syncing) {
      setSyncing(true);
      flushQueue().then((res) => {
        setSyncing(false);
        if (res.flushed > 0) {
          toast({
            title: "Back online",
            description: `Synced ${res.flushed} pending change${res.flushed === 1 ? "" : "s"}.`,
          });
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.online, state.queued]);

  if (state.online && state.queued === 0) {
    return (
      <span
        className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full"
        title="Online"
      >
        <Wifi className="w-3 h-3" />
        Online
      </span>
    );
  }

  if (!state.online) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full"
        title={`Offline — ${state.queued} pending`}
      >
        <WifiOff className="w-3 h-3" />
        <span className="hidden sm:inline">Offline</span>
        {state.queued > 0 && (
          <span className="ml-0.5 bg-rose-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
            {state.queued}
          </span>
        )}
      </span>
    );
  }

  // Online but syncing
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
      {syncing ? (
        <>
          <Loader2 className="w-3 h-3 animate-spin" />
          <span className="hidden sm:inline">Syncing…</span>
          <span className="ml-0.5 text-[9px] font-bold">{state.queued}</span>
        </>
      ) : (
        <>
          <CheckCircle2 className="w-3 h-3" />
          <span className="hidden sm:inline">Synced</span>
        </>
      )}
    </span>
  );
};

export default OfflineIndicator;
