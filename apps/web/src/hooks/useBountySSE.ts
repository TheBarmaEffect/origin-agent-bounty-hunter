import { useEffect, useRef } from 'react';
import { isStaticHost, subscribeMock } from '../lib/mockRace';

export function useBountySSE(bountyId: string | null, onEvent: (event: any) => void) {
  const esRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!bountyId) return;

    // GitHub Pages / static host: no backend — subscribe to the in-browser mock.
    if (isStaticHost()) {
      const unsub = subscribeMock(bountyId, (e) => onEventRef.current(e));
      return () => unsub();
    }

    const es = new EventSource(`/api/bounties/${bountyId}/events`);
    esRef.current = es;
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        onEventRef.current(event);
      } catch {}
    };
    es.onerror = () => es.close();
    return () => {
      es.close();
      esRef.current = null;
    };
  }, [bountyId]);
}
