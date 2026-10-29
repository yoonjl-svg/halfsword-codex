// Appearance review only. No origin, epithet, story or new dialogue.
export function createJuliaAlter(base) {
  return {...structuredClone(base),id:'julia_mad',variantOf:'julia',mad:true,
    name:'광기의 쥘리아 크리스테바',appearanceOnly:true,retainBaseStats:true,
    proficiencyFixed:4,eyes:'madGlow',lookVersion:'v1-native-mechanical',
    look:{...base.look,outfit:'julia_mechanical',tunic:0x293340,quilt:0x202832,
      sleeve:0xc0c0b7,hoseUpper:0x29313a,metal:0x8a9293},
    backstory:'',taunt:'',lines:{intro:[],win:[]}};
}
