"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createForumGateway } from "./forum-service";
import type { ForumAttachment, ForumPlayerCard, ForumPost, ForumSection, ForumSnapshot } from "./types";

type Props={player:ForumPlayerCard;day:number;period:string;onClose:()=>void};
const STICKERS=[{glyph:"🌿",label:"灵草摇曳"},{glyph:"⚔️",label:"拔剑围观"},{glyph:"🐟",label:"灵鱼上钩"},{glyph:"🔥",label:"炉火正旺"},{glyph:"✨",label:"仙缘降临"},{glyph:"🦊",label:"灵狐探头"}];
const NAV:Array<{id:ForumSection;seal:string;name:string;note:string}>=[
  {id:"square",seal:"闻",name:"诸界闻壁",note:"道友新帖"},
  {id:"official",seal:"诏",name:"官方论坛",note:"司天监公告"},
  {id:"secrets",seal:"秘",name:"游戏秘闻",note:"未证实卷宗"},
];

function imageFromFile(file:File):Promise<string>{
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error("read failed"));reader.onload=()=>{const image=new Image();image.onerror=()=>reject(new Error("image failed"));image.onload=()=>{const max=1280;const scale=Math.min(1,max/Math.max(image.width,image.height));const canvas=document.createElement("canvas");canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);canvas.getContext("2d")?.drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL("image/jpeg",.82));};image.src=String(reader.result);};reader.readAsDataURL(file);});
}

function PlayerCardView({card}: {card:ForumPlayerCard}){
  return <div className="forum-player-card"><div className="player-card-seal">侠</div><div><small>槐安人物卡 · PLAYER CARD</small><h4>{card.name}</h4><p>{card.title} · 境界 {card.level}</p></div><dl><div><dt>修为</dt><dd>{card.cultivation.toLocaleString()}</dd></div><div><dt>秘境</dt><dd>{card.dungeons} 境</dd></div><div><dt>牵绊</dt><dd>{card.bondName} {card.bond}</dd></div></dl></div>;
}

function PostCard({post,onLike}:{post:ForumPost;onLike:(id:string)=>void}){
  return <article className={`forum-post ${post.official?"official":""} ${post.pinned?"pinned":""}`}>
    <header><span className="post-avatar">{post.avatar}</span><div><strong>{post.author}{post.official&&<b>官</b>}</strong><small>{post.authorTitle} · {post.createdAt}</small></div>{post.pinned&&<i>置顶</i>}</header>
    <p>{post.content}</p>
    {!!post.attachments.length&&<div className="post-attachments">{post.attachments.map((attachment,index)=>attachment.kind==="image"?<img key={index} src={attachment.src} alt={attachment.alt}/>:attachment.kind==="sticker"?<span key={index} className="post-sticker" title={attachment.label}>{attachment.sticker}<small>{attachment.label}</small></span>:<PlayerCardView key={index} card={attachment.card}/>)}</div>}
    <div className="post-tags">{post.tags.map(tag=><span key={tag}>#{tag}</span>)}</div>
    <footer><button type="button" className={post.liked?"liked":""} onClick={()=>onLike(post.id)}><i>♥</i>{post.likes}</button><button type="button"><i>言</i>{post.replies}</button><button type="button"><i>藏</i>收录</button></footer>
  </article>;
}

export default function ForumModal({player,day,period,onClose}:Props){
  const gateway=useMemo(()=>createForumGateway(),[]);
  const [snapshot,setSnapshot]=useState<ForumSnapshot|null>(null);
  const [section,setSection]=useState<ForumSection>("square");
  const [announcement,setAnnouncement]=useState(0);
  const [content,setContent]=useState("");
  const [attachments,setAttachments]=useState<ForumAttachment[]>([]);
  const [stickersOpen,setStickersOpen]=useState(false);
  const [sending,setSending]=useState(false);
  const [notice,setNotice]=useState("");
  const fileRef=useRef<HTMLInputElement>(null);

  useEffect(()=>{let active=true;gateway.load().then(data=>{if(active)setSnapshot(data)}).catch(()=>setNotice("闻壁暂时无法展开，请稍后再试。"));return()=>{active=false}},[gateway]);
  useEffect(()=>{const timer=window.setInterval(()=>setAnnouncement(value=>snapshot?.announcements.length?(value+1)%snapshot.announcements.length:0),5200);return()=>window.clearInterval(timer)},[snapshot?.announcements.length]);
  useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key==="Escape")onClose()};window.addEventListener("keydown",close);const overflow=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{window.removeEventListener("keydown",close);document.body.style.overflow=overflow}},[onClose]);

  const posts=(snapshot?.posts??[]).filter(post=>post.channel===section);
  const currentAnnouncement=snapshot?.announcements[announcement];

  async function addImage(file?:File){
    if(!file||!file.type.startsWith("image/"))return;
    if(file.size>8*1024*1024){setNotice("留影过大，请选择 8MB 以内的图片。");return;}
    try{const src=await imageFromFile(file);setAttachments(list=>[...list.filter(item=>item.kind!=="image"),{kind:"image",src,alt:"道友上传的留影"}]);setNotice("留影已收入待发纸卷。")}
    catch{setNotice("这张留影无法读取，请换一张试试。")}
  }

  function addSticker(sticker:string,label:string){setAttachments(list=>[...list.filter(item=>item.kind!=="sticker"),{kind:"sticker",sticker,label}]);setStickersOpen(false);}
  function togglePlayerCard(){setAttachments(list=>list.some(item=>item.kind==="player_card")?list.filter(item=>item.kind!=="player_card"):[...list,{kind:"player_card",card:player}]);}

  async function publish(){
    if(!content.trim()&&!attachments.length){setNotice("至少写下一句话，或附上一份内容。");return;}
    setSending(true);
    try{const post=await gateway.createPost({content:content.trim(),attachments,player});setSnapshot(current=>current?{...current,posts:[post,...current.posts]}:current);setContent("");setAttachments([]);setSection("square");setNotice("纸鹤已将帖子送上诸界闻壁。")}
    catch{setNotice("纸鹤迷了路，帖子尚未送出。")}
    finally{setSending(false)}
  }

  async function like(postId:string){
    setSnapshot(current=>current?{...current,posts:current.posts.map(post=>post.id===postId?{...post,liked:!post.liked,likes:Math.max(0,post.likes+(post.liked?-1:1))}:post)}:current);
    try{await gateway.toggleLike(postId)}catch{/* Optimistic local interaction remains visible. */}
  }

  return <div className="forum-backdrop" role="presentation"><section className="forum-shell" role="dialog" aria-modal="true" aria-label="槐安情报局论坛">
    <header className="forum-heading"><button type="button" className="forum-close" onClick={onClose} aria-label="离开论坛">‹</button><div className="forum-brand"><span>闻</span><div><small>HUAIAN INTELLIGENCE BUREAU</small><h2>槐安情报局</h2></div></div><div className="forum-clock"><i className="forum-live-dot"/><span>第 {day} 日 · {period}</span><b>{snapshot?.syncMode==="online"?"诸界在线":"本地演示"}</b></div></header>
    <div className="forum-announcement"><span>{currentAnnouncement?.tag??"传讯"}</span><button type="button" onClick={()=>setAnnouncement(value=>snapshot?.announcements.length?(value+1)%snapshot.announcements.length:0)}><strong>{currentAnnouncement?.title??"正在展开世界传讯……"}</strong><small>{currentAnnouncement?.detail}</small></button><div>{snapshot?.announcements.map((item,index)=><button type="button" key={item.id} className={index===announcement?"active":""} onClick={()=>setAnnouncement(index)} aria-label={`查看公告${index+1}`}/>)}</div></div>
    <div className="forum-layout">
      <aside className="forum-nav"><p>闻壁分卷</p>{NAV.map(item=><button type="button" key={item.id} className={section===item.id?"active":""} onClick={()=>setSection(item.id)}><i>{item.seal}</i><span><strong>{item.name}</strong><small>{item.note}</small></span><b>{snapshot?.posts.filter(post=>post.channel===item.id).length??"·"}</b></button>)}<div className="forum-npc-note"><img src="/assets/characters/wenren-fei-v1.png" alt="闻人绯"/><span><small>情报局主事</small><strong>闻人绯</strong><p>“真假消息都能开价，但只有证据能落印。”</p></span></div></aside>
      <main className="forum-main">
        {section==="square"&&<section className="forum-composer"><div className="composer-avatar">我</div><div className="composer-body"><textarea value={content} maxLength={500} onChange={event=>setContent(event.target.value)} placeholder="写下见闻、攻略或邀约……"/><div className="composer-attachments">{attachments.map((item,index)=>item.kind==="image"?<button key={index} type="button" onClick={()=>setAttachments(list=>list.filter((_,i)=>i!==index))}><img src={item.src} alt="待发布留影"/><span>×</span></button>:item.kind==="sticker"?<button key={index} type="button" className="composer-sticker" onClick={()=>setAttachments(list=>list.filter((_,i)=>i!==index))}>{item.sticker}<span>×</span></button>:<button key={index} type="button" className="composer-card" onClick={()=>setAttachments(list=>list.filter((_,i)=>i!==index))}>人物卡已附上 <span>×</span></button>)}</div><footer><div><input ref={fileRef} hidden type="file" accept="image/*" onChange={event=>{void addImage(event.target.files?.[0]);event.currentTarget.value=""}}/><button type="button" onClick={()=>fileRef.current?.click()}><i>景</i>留影</button><span className="sticker-anchor"><button type="button" onClick={()=>setStickersOpen(value=>!value)}><i>颜</i>表情印</button>{stickersOpen&&<span className="sticker-picker">{STICKERS.map(item=><button type="button" key={item.label} title={item.label} onClick={()=>addSticker(item.glyph,item.label)}>{item.glyph}</button>)}</span>}</span><button type="button" className={attachments.some(item=>item.kind==="player_card")?"active":""} onClick={togglePlayerCard}><i>卡</i>人物卡</button></div><span>{content.length}/500</span><button type="button" className="publish-post" disabled={sending} onClick={publish}>{sending?"纸鹤传送中":"发布见闻"}</button></footer></div></section>}
        <header className="forum-section-title"><div><small>{section==="square"?"PLAYER FORUM":section==="official"?"OFFICIAL ARCHIVE":"SECRET SCROLLS"}</small><h3>{NAV.find(item=>item.id===section)?.name}</h3></div><span>{section==="square"?"最新见闻":section==="official"?"权威发布":"探索线索"}<i/></span></header>
        <div className="forum-feed">{!snapshot?<div className="forum-loading"><i/><span>纸鹤正在搬运卷宗……</span></div>:posts.map(post=><PostCard key={post.id} post={post} onLike={like}/>)}</div>
      </main>
      <aside className="forum-ranking"><header><div><small>CELESTIAL RANK</small><h3>问道榜</h3></div><span>本旬</span></header><div className="rank-podium">{snapshot?.ranking.slice(0,3).map((entry,index)=><article key={entry.id} className={`rank-${index+1}`}><b>{index+1}</b><span style={{"--rank-accent":entry.accent} as React.CSSProperties}>{entry.seal}</span><strong>{entry.name}</strong><small>{entry.score.toLocaleString()}</small></article>)}</div><div className="rank-list">{snapshot?.ranking.slice(3).map((entry,index)=><article key={entry.id}><b>{index+4}</b><span style={{"--rank-accent":entry.accent} as React.CSSProperties}>{entry.seal}</span><div><strong>{entry.name}</strong><small>Lv.{entry.level} · {entry.title}</small></div><em>{entry.score.toLocaleString()}</em></article>)}</div><PlayerCardView card={player}/><p className="ranking-note">榜单数据为本地演示。联网后由赛季服务统一结算。</p></aside>
    </div>
    {notice&&<button type="button" className="forum-toast" onClick={()=>setNotice("")}>{notice}</button>}
  </section></div>;
}
