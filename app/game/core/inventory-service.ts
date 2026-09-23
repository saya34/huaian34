import { PRODUCTS } from "../alchemy/item-data";
import { MUTATIONS,type MutationId,type ProductStack } from "../alchemy/commissions";
import type { UnifiedItemStack } from "./types";
export { hasInventoryItem, inventoryCount, inventoryMatches, itemTemplateId } from "./item-query";
import { itemTemplateId } from "./item-query";

export const alchemyInstanceId=(productId:string,mutation:MutationId)=>`alchemy:${productId}::${mutation}`;

export function nextInventoryAcquisitionOrder(items:Record<string,UnifiedItemStack>,floor=0){
  return Object.values(items).reduce((latest,item)=>Math.max(latest,item.lastAcquiredAt??0),floor)+1;
}

/** Adds to a stack while preserving instance metadata and moving it to the front of the bag. */
export function acquireInventoryStack(items:Record<string,UnifiedItemStack>,incoming:UnifiedItemStack,floor=0):UnifiedItemStack{
  const previous=items[incoming.itemId];
  return {...previous,...incoming,amount:(previous?.amount??0)+incoming.amount,lastAcquiredAt:nextInventoryAcquisitionOrder(items,floor)};
}

/** Synchronises an absolute count from a legacy projection without losing recency metadata. */
export function setInventoryStackAmount(items:Record<string,UnifiedItemStack>,incoming:UnifiedItemStack,amount:number,floor=0):UnifiedItemStack{
  const previous=items[incoming.itemId];
  const gained=amount>(previous?.amount??0);
  return {...previous,...incoming,amount,...(gained?{lastAcquiredAt:nextInventoryAcquisitionOrder(items,floor)}:previous?.lastAcquiredAt?{lastAcquiredAt:previous.lastAcquiredAt}:{})};
}

export function syncAlchemyProductInventory(items:Record<string,UnifiedItemStack>,stacks:Record<string,ProductStack>){
  const productIds=new Set(PRODUCTS.map((item)=>item.id));
  const next=Object.fromEntries(Object.entries(items).filter(([,item])=>!item.sourceTags.includes("alchemy-product")&&!(item.itemType==="pill"&&productIds.has(item.itemId)&&!item.templateId)));
  let acquisitionOrder=nextInventoryAcquisitionOrder(items)-1;
  for(const stack of Object.values(stacks)){
    if(stack.count<=0)continue;
    const template=PRODUCTS.find(item=>item.id===stack.productId);if(!template)continue;
    const id=alchemyInstanceId(stack.productId,stack.mutation);
    const previous=items[id];
    if(stack.count>(previous?.amount??0))acquisitionOrder+=1;
    next[id]={...previous,itemId:id,templateId:stack.productId,itemType:"pill",rarity:Math.max(1,Math.min(7,template.rarity)) as UnifiedItemStack["rarity"],amount:stack.count,quality:template.quality,mutation:stack.mutation,displayName:`${MUTATIONS[stack.mutation].prefix}${template.name}`,sourceTags:["alchemy-product","玄火丹炉"],...(stack.count>(previous?.amount??0)?{lastAcquiredAt:acquisitionOrder}:previous?.lastAcquiredAt?{lastAcquiredAt:previous.lastAcquiredAt}:{})};
  }
  return next;
}

export function inventoryProjection(items:Record<string,UnifiedItemStack>){
  return Object.fromEntries(Object.entries(items).map(([id,item])=>[id,{itemType:item.itemType,templateId:itemTemplateId(item),rarity:item.rarity,amount:item.amount}]));
}
