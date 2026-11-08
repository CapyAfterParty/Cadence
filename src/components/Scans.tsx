import { useEffect, useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ImagePlus, X } from 'lucide-react';
import { db } from '../db/db';
import type { ID, Scan, ScanOwner } from '../db/types';
import { addScans, deleteScan } from '../db/ops';
import { Button, Empty } from './ui';

export function useScans(ownerType: ScanOwner, ownerId: ID | undefined) {
  return useLiveQuery(
    () => (ownerId ? db.scans.where('[ownerType+ownerId]').equals([ownerType, ownerId]).toArray() : []),
    [ownerType, ownerId],
  );
}

export function ScanUploadButton({ ownerType, ownerId, label = 'Upload scan', size }: { ownerType: ScanOwner; ownerId: ID; label?: string; size?: 'sm' }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button size={size} onClick={() => input.current?.click()}>
        <ImagePlus size={16} strokeWidth={1.5} /> {label}
      </Button>
      <input
        ref={input}
        type="file"
        accept="image/*,application/pdf"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) addScans(ownerType, ownerId, e.target.files);
          e.target.value = '';
        }}
      />
    </>
  );
}

function ScanTile({ scan }: { scan: Scan }) {
  const url = useMemo(() => URL.createObjectURL(scan.blob), [scan.blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const isImage = scan.blob.type.startsWith('image/');
  return (
    <div className="scan">
      <a href={url} target="_blank" rel="noreferrer" title={scan.name}>
        {isImage ? <img src={url} alt={scan.name} loading="lazy" /> : <div className="file">{scan.name}</div>}
      </a>
      <Button icon size="sm" variant="ghost" className="del" aria-label={`Delete ${scan.name}`} onClick={() => deleteScan(scan.id)}>
        <X size={14} strokeWidth={1.5} />
      </Button>
    </div>
  );
}

export function ScanGrid({ ownerType, ownerId, emptyText = 'No scans yet.' }: { ownerType: ScanOwner; ownerId: ID; emptyText?: string }) {
  const scans = useScans(ownerType, ownerId);
  if (!scans) return null;
  if (!scans.length) return <Empty text={emptyText} action={<ScanUploadButton ownerType={ownerType} ownerId={ownerId} size="sm" />} />;
  return (
    <div className="scan-grid">
      {scans.map((s) => (
        <ScanTile key={s.id} scan={s} />
      ))}
    </div>
  );
}
