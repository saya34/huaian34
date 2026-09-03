"use client";

type Props={day:number;period:string;onOpenForum:()=>void;onNotice:(message:string)=>void};

export default function IntelligenceBureauScene({day,period,onOpenForum,onNotice}:Props){
  return <div className="bureau-scene-layer" aria-label="情报局场景交互">
    <div className="bureau-lanterns" aria-hidden="true"><i/><i/><i/></div>
    <button type="button" className="bureau-hotspot bureau-board-hotspot" onClick={onOpenForum}>
      <span className="bureau-hotspot-ripple"><b>闻</b><i/></span>
      <em><small>可交互 · 万象闻壁</small><strong>进入修真论坛</strong><u>榜单 · 世界公告 · 道友帖子</u></em>
    </button>
    <button type="button" className="bureau-hotspot bureau-scroll-hotspot" onClick={()=>onNotice(`第 ${day} 日 · ${period}：今日密报已誊录，尚有三卷待核。`)}>
      <span className="bureau-hotspot-ripple"><b>卷</b><i/></span>
      <em><small>案上密卷</small><strong>查看值守札记</strong></em>
    </button>
    <div className="bureau-world-status"><span>万象镜在线</span><i/><b>本地镜像</b><small>联网后将自动接入诸界闻壁</small></div>
  </div>;
}
