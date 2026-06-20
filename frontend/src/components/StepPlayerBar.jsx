import { Button, Segmented, Tooltip } from "antd";
import {
  CaretRightFilled,
  FastForwardOutlined,
  PauseOutlined,
  ReloadOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
} from "@ant-design/icons";

/**
 * 逐步演示控制条：播放/暂停、上一步/下一步、重置、跳到末尾、调速、进度。
 * 与 useStepPlayer 配套使用。
 */
export default function StepPlayerBar({ player, label = "演示进度", tone = "#0f766e" }) {
  const { visible, total, playing, speed, setSpeed, toggle, next, prev, reset, showAll, done } = player;
  const percent = total > 0 ? Math.round((visible / total) * 100) : 0;

  return (
    <div className="step-player-bar" style={{ "--player-tone": tone }}>
      <div className="step-player-controls">
        <Tooltip title="重置">
          <Button shape="circle" icon={<ReloadOutlined />} onClick={reset} disabled={visible === 0} />
        </Tooltip>
        <Tooltip title="上一步">
          <Button shape="circle" icon={<StepBackwardOutlined />} onClick={prev} disabled={visible === 0} />
        </Tooltip>
        <Tooltip title={playing ? "暂停" : done ? "重新播放" : "播放"}>
          <Button
            className="step-player-play"
            shape="circle"
            type="primary"
            size="large"
            icon={playing ? <PauseOutlined /> : <CaretRightFilled />}
            onClick={toggle}
          />
        </Tooltip>
        <Tooltip title="下一步">
          <Button shape="circle" icon={<StepForwardOutlined />} onClick={next} disabled={done} />
        </Tooltip>
        <Tooltip title="跳到末尾">
          <Button shape="circle" icon={<FastForwardOutlined />} onClick={showAll} disabled={done} />
        </Tooltip>
      </div>

      <div className="step-player-progress">
        <div className="step-player-progress-head">
          <span>{label}</span>
          <strong>
            {visible} / {total}
          </strong>
        </div>
        <div className="step-player-track">
          <span className="step-player-fill" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <Segmented
        className="step-player-speed"
        value={speed}
        onChange={setSpeed}
        options={[
          { label: "0.5×", value: 0.5 },
          { label: "1×", value: 1 },
          { label: "2×", value: 2 },
        ]}
      />
    </div>
  );
}
