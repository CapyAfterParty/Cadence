// Autosaving inputs. They keep their own text while typing and write to the
// database shortly after you stop, and again on blur. No save buttons.
import { useEffect, useRef, useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';

function useAutosave(value: string, onSave: (v: string) => void, delay = 400) {
  const [text, setText] = useState(value);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef({ text, onSave });
  latest.current = { text, onSave };

  // Follow outside changes (undo, import) when the user is not mid-edit.
  useEffect(() => {
    if (!dirty.current) setText(value);
  }, [value]);

  const flush = () => {
    clearTimeout(timer.current);
    if (dirty.current) {
      dirty.current = false;
      latest.current.onSave(latest.current.text);
    }
  };
  useEffect(() => flush, []); // save on unmount

  const change = (v: string) => {
    setText(v);
    dirty.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, delay);
  };
  return { text, change, flush };
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: string; onSave: (v: string) => void };

export function AutoInput({ value, onSave, className = 'input', ...rest }: InputProps) {
  const { text, change, flush } = useAutosave(value, onSave);
  return <input className={className} value={text} onChange={(e) => change(e.target.value)} onBlur={flush} {...rest} />;
}

type AreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & { value: string; onSave: (v: string) => void };

export function AutoTextarea({ value, onSave, className = 'textarea', ...rest }: AreaProps) {
  const { text, change, flush } = useAutosave(value, onSave);
  return <textarea className={className} value={text} onChange={(e) => change(e.target.value)} onBlur={flush} {...rest} />;
}
