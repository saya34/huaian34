import { PRODUCTS } from "../alchemy/item-data";
import { MUTATIONS,type MutationId,type ProductStack } from "../alchemy/commissions";
import type { UnifiedItemStack } from "./types";
export { hasInventoryItem, inventoryCount, inventoryMatches, itemTemplateId } from "./item-query";
import { itemTemplateId } from "./item-query";

export const alchemyInstanceId=(productId:string,mutation:MutationId)=>`alchemy:${productId}::${mutation}`;

export function syncAlchemyProductInventory(items:Record<string,UnifiedItemStack>,stacks:Record<string,ProductStack>){
  const productIds=new Set(PRODUCTS.map((item)=>item.id));
  const next=Object.fromEntries(Object.entries(items).filter(([,item])=>!item.sourceTags.includes("alchemy-product")&&!(item.itemType==="pill"&&productIds.has(item.itemId)&&!item.templateId)));
  for(const stack of Object.values(stacks)){
    if(stack.count<=0)continue;
    const template=PRODUCTS.find(item=>item.id===stack.productId);if(!template)continue;
    const id=alchemyInstanceId(stack.productId,stack.mutation);
    next[id]={itemId:id,templateId:stack.productId,itemType:"pill",rarity:Math.max(1,Math.min(7,template.rarity)) as UnifiedItemStack["rarity"],amount:stack.count,quality:template.quality,mutation:stack.mutation,displayName:`${MUTATIONS[stack.mutation].prefix}${template.name}`,sourceTags:["alchemy-product","玄火丹炉"]};
  }
  return next;
}

export function inventoryProjection(items:Record<string,UnifiedItemStack>){
  return Object.fromEntries(Object.entries(items).map(([id,item])=>[id,{itemType:item.itemType,templateId:itemTemplateId(item),rarity:item.rarity,amount:item.amount}]));
}
