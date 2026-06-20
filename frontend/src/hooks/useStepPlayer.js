import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 逐步演示播放控制器。
 * 维护"当前已揭示步数 visible（0..total）"，支持自动播放、暂停、单步前进/后退、重置与调速。
 *
 * @param {number} total 总步数
 * @param {object} [options]
 * @param {number} [options.intervalMs] 自动播放每步间隔（默认 1100ms）
 * @param {boolean} [options.autoStart] 是否进入后自动播放（默认 true）
 */
export function useStepPlayer(total, options = {}) {
  const { intervalMs = 1100, autoStart = true } = options;
  const [visible, setVisible] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const timerRef = useRef(null);
  const startedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 进入或 total 变化时初始化：从 0 开始（可自动播放）
  useEffect(() => {
    setVisible(0);
    startedRef.current = false;
    if (total > 0 && autoStart) {
      setPlaying(true);
    } else {
      setPlaying(false);
    }
    return clearTimer;
  }, [total, autoStart, clearTimer]);

  // 自动播放推进
  useEffect(() => {
    clearTimer();
    if (!playing) return undefined;
    if (visible >= total) {
      setPlaying(false);
      return undefined;
    }
    timerRef.current = setTimeout(() => {
      setVisible((v) => Math.min(total, v + 1));
    }, Math.max(180, intervalMs / speed));
    return clearTimer;
  }, [playing, visible, total, intervalMs, speed, clearTimer]);

  const play = useCallback(() => {
    if (visible >= total) setVisible(0);
    setPlaying(true);
  }, [visible, total]);

  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => (playing ? setPlaying(false) : play()), [playing, play]);

  const next = useCallback(() => {
    setPlaying(false);
    setVisible((v) => Math.min(total, v + 1));
  }, [total]);

  const prev = useCallback(() => {
    setPlaying(false);
    setVisible((v) => Math.max(0, v - 1));
  }, []);

  const reset = useCallback(() => {
    setPlaying(false);
    setVisible(0);
  }, []);

  const showAll = useCallback(() => {
    setPlaying(false);
    setVisible(total);
  }, [total]);

  const done = visible >= total && total > 0;

  return {
    visible,
    total,
    playing,
    speed,
    setSpeed,
    play,
    pause,
    toggle,
    next,
    prev,
    reset,
    showAll,
    done,
  };
}
