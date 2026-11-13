export const fixtures=Array.from({length:128},(_,i)=>({
 body_weight:45+(i%40)*2,reference_sex:i%2?'f':'m',entries:[
  ...(i%5!==0?[{code:['ohp','bench','squat','dead'][i%4],value:10+(i*7)%190,reps:1+i%12}]:[]),
  ...(i%3!==0?[{code:'pushup',value:1+(i*11)%100,reps:1}]:[]),
  ...(i%4!==0?[{code:'jump',value:100+(i*13)%220,reps:1}]:[]),
  ...(i%6!==0?[{code:'run5k',value:900+(i*43)%2000,reps:1}]:[]),
  {code:'plank',value:10+(i*19)%500,reps:1}
 ]
}));
