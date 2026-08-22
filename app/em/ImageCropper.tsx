"use client";

import { useEffect, useRef, useState } from "react";

type Props = { file: File; aspectRatio: number; aspectLabel: string; onCancel: () => void; onConfirm: (file: File) => void };

export default function ImageCropper({ file, aspectRatio, aspectLabel, onCancel, onConfirm }: Props) {
  const [url,setUrl]=useState(""),[size,setSize]=useState({width:1,height:1}),[zoom,setZoom]=useState(1),[offset,setOffset]=useState({x:0,y:0});
  const frame=useRef<HTMLDivElement>(null), drag=useRef<{x:number;y:number;ox:number;oy:number}|null>(null);
  useEffect(()=>{const next=URL.createObjectURL(file);setUrl(next);return()=>URL.revokeObjectURL(next)},[file]);
  function metrics(){const box=frame.current?.getBoundingClientRect();if(!box)return null;const scale=Math.max(box.width/size.width,box.height/size.height)*zoom;return{box,scale,width:size.width*scale,height:size.height*scale}}
  function clamp(x:number,y:number){const value=metrics();if(!value)return{x,y};return{x:Math.max(-(value.width-value.box.width)/2,Math.min((value.width-value.box.width)/2,x)),y:Math.max(-(value.height-value.box.height)/2,Math.min((value.height-value.box.height)/2,y))}}
  function pointerMove(event:React.PointerEvent){if(!drag.current)return;setOffset(clamp(drag.current.ox+event.clientX-drag.current.x,drag.current.oy+event.clientY-drag.current.y))}
  async function confirm(){const value=metrics();if(!value)return;const bitmap=await createImageBitmap(file);const sx=(value.width/2-value.box.width/2-offset.x)/value.scale,sy=(value.height/2-value.box.height/2-offset.y)/value.scale,sw=value.box.width/value.scale,sh=value.box.height/value.scale;const long=aspectRatio>=1?1600:1200;const outW=aspectRatio>=1?long:Math.round(long*aspectRatio),outH=aspectRatio>=1?Math.round(long/aspectRatio):long;const canvas=document.createElement("canvas");canvas.width=outW;canvas.height=outH;canvas.getContext("2d")?.drawImage(bitmap,sx,sy,sw,sh,0,0,outW,outH);bitmap.close();const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/webp",.88));if(blob)onConfirm(new File([blob],file.name.replace(/\.[^.]+$/,".webp"),{type:"image/webp"}))}
  return <div className="crop-overlay" role="presentation"><section className="crop-dialog" role="dialog" aria-label="裁剪上传图片">
    <header><div><small>固定比例 · {aspectLabel}</small><h3>移动和缩放图片</h3></div><button onClick={onCancel}>×</button></header>
    <div className="crop-stage"><div ref={frame} className="crop-frame" style={{aspectRatio,width:`min(${aspectRatio < 1 ? 420 : 620}px, 80vw, calc(58vh * ${aspectRatio}))`}} onPointerDown={event=>{drag.current={x:event.clientX,y:event.clientY,ox:offset.x,oy:offset.y};event.currentTarget.setPointerCapture(event.pointerId)}} onPointerMove={pointerMove} onPointerUp={()=>{drag.current=null}}>
      {url&&<img src={url} alt="待裁剪图片" draggable={false} onLoad={event=>setSize({width:event.currentTarget.naturalWidth,height:event.currentTarget.naturalHeight})} style={{width:size.width*(metrics()?.scale??1),height:size.height*(metrics()?.scale??1),transform:`translate(-50%,-50%) translate(${offset.x}px,${offset.y}px)`}}/>}<i/><span>拖拽调整取景区域</span>
    </div></div>
    <label className="crop-zoom"><span>缩放</span><input type="range" min="1" max="3" step="0.01" value={zoom} onChange={event=>{setZoom(Number(event.target.value));requestAnimationFrame(()=>setOffset(current=>clamp(current.x,current.y)))}}/><b>{Math.round(zoom*100)}%</b></label>
    <footer><button className="quiet" onClick={onCancel}>取消</button><button className="primary" onClick={()=>void confirm()}>确认裁剪并上传</button></footer>
  </section></div>;
}
