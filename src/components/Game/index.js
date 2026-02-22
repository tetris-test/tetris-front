import { getPlayerId } from "../../utils/playerId";
import React, { useState, useEffect } from "react";
import { useDrag } from "react-use-gesture";
import BarLoader from "react-spinners/BarLoader";

import Stage from "../Stage";
import { useInterval } from "../../hooks/useInterval";
import Center from "../Center";

import { PrintPlayerInMap } from "../../utils/Utils";

const STAGE_HEIGHT = 18;
const STAGE_WIDTH = 10;

const initialMap = [...new Array(STAGE_HEIGHT)].map(() =>
  [...new Array(STAGE_WIDTH)].map(() => ({ fill: 0, color: [] }))
);

const colors = ["#e54b4b","#9a031e","#fcdc4d","#005397","#0bbcd6","#20ad65","#f8ebee"];

const I = { bloco: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]] };
const O = { bloco: [[1,1],[1,1]] };
const T = { bloco: [[0,0,0],[1,1,1],[0,1,0]] };
const J = { bloco: [[0,1,0],[0,1,0],[1,1,0]] };
const L = { bloco: [[0,1,0],[0,1,0],[0,1,1]] };
const S = { bloco: [[0,1,1],[1,1,0],[0,0,0]] };
const Z = { bloco: [[1,1,0],[0,1,1],[0,0,0]] };

const getRandomBloco = () => {
  const blocos = [I,O,T,J,L,S,Z];
  const bloco = blocos[Math.floor(Math.random()*blocos.length)];
  bloco.color = colors[Math.floor(Math.random()*colors.length)];
  return bloco;
};

const getRandomPlayer = player => {
  let bloco,next;
  if (player && player.next) {
    bloco = JSON.parse(JSON.stringify(player.next));
    next = getRandomBloco();
  }
  if (!bloco) bloco = getRandomBloco();
  if (!next) next = getRandomBloco();
  const pos = [0, Math.floor(STAGE_WIDTH/2 - 2/2)];
  return { pos, bloco, next };
};

const Game = () => {
  const [map,setMap] = useState(initialMap);
  const [player,setPlayer] = useState();
  const [down,setDown] = useState(false);
  const [pause,setPause] = useState(false);
  const [tick,setTick] = useState(Date.now());
  const [hintPlayer,setHintPlayer] = useState();
  const [spaceReleased,setSpaceReleased] = useState(true);
  const [lines,setLines] = useState(0);
  const [score,setScore] = useState(0);
  const [level,setLevel] = useState(1);
  const [gameOver,setGameOver] = useState(false);

  const restartGame = () => {
    setMap(initialMap);
    setLines(0);
    setScore(0);
    setLevel(1);
    setGameOver(false);
  };

  const loseGame = () => {
    fetch("http://localhost:4000/score",{
      method:"POST",
      headers:{ "Content-Type":"application/json"},
      body:JSON.stringify({ playerId:getPlayerId(), score })
    });
    setGameOver(true);
  };

  useEffect(()=>{
    const next = (1000*(level+1)**3)/5;
    if(score>=next) setLevel(l=>l+1);
  },[score,level]);

  const drop = () => {
    if(!player){ setPlayer(getRandomPlayer()); return; }
    setPlayer(p=>{
      const newPos = getNewPlayerPos("down");
      if(p.pos===newPos){
        setMap(m=>checkMap(PrintPlayerInMap(p,m)));
        const np = getRandomPlayer(p);
        if(!validatePosition(np.pos,np.bloco)) loseGame();
        return np;
      }
      return {...p,pos:newPos};
    });
  };

  const rotatePlayer = () => {
    const cp = JSON.parse(JSON.stringify(player));
    let m = cp.bloco.bloco.map((_,i)=>cp.bloco.bloco.map(c=>c[i]));
    m = m.map(r=>r.reverse());
    if(validatePosition(player.pos,{bloco:m}))
      setPlayer({...player,bloco:{...player.bloco,bloco:m}});
  };

  const keyDown = ({keyCode})=>{
    if(pause||gameOver) return;
    if(keyCode===37) setPlayer(p=>({...p,pos:getNewPlayerPos("left")}));
    if(keyCode===38) rotatePlayer();
    if(keyCode===39) setPlayer(p=>({...p,pos:getNewPlayerPos("right")}));
    if(keyCode===40){ setTick(Date.now()); setDown(true);}
  };

  const keyUp = ({keyCode})=>{
    if(keyCode===40){ setDown(false); if(Date.now()-tick<80) drop(); }
    if(keyCode===32) setSpaceReleased(true);
  };

  const checkMap = React.useCallback(map=>{
    let rows=[];
    map.forEach((r,y)=>r.every(p=>p.fill)&&rows.push(y));
    if(rows.length){
      let nm = map.slice();
      rows.forEach(y=>{
        for(let i=nm.length-1;i>=0;i--)
          nm[i]=i>0?nm[i-1]:[...Array(STAGE_WIDTH)].map(()=>({fill:0,color:[]}));
      });
      setLines(l=>l+rows.length);
      setScore(s=>s+300*rows.length);
      return nm;
    }
    return map;
  },[]);

  const validatePosition = React.useCallback((pos,bloco)=>{
    for(let y=0;y<bloco.bloco.length;y++)
      for(let x=0;x<bloco.bloco[y].length;x++)
        if(bloco.bloco[y][x]){
          const my=pos[0]+y,mx=pos[1]+x;
          if(mx<0||mx>=STAGE_WIDTH||my>=STAGE_HEIGHT||!map[my]||map[my][mx].fill) return false;
        }
    return true;
  },[map]);

  const calculateHintPlayer = React.useCallback(p=>{
    let h=[...p.pos];
    while(validatePosition([h[0]+1,h[1]],p.bloco)) h=[h[0]+1,h[1]];
    return {pos:h,bloco:p.bloco};
  },[validatePosition]);

  const getNewPlayerPos = React.useCallback(m=>{
    if(!player) return;
    const d = m==="down"?[1,0]:m==="left"?[0,-1]:[0,1];
    const np=[player.pos[0]+d[0],player.pos[1]+d[1]];
    if(!validatePosition(np,player.bloco)) return player.pos;
    return np;
  },[player,validatePosition]);

  useInterval(()=>drop(), pause||gameOver?null: down?50:400);

  useEffect(()=>{ if(player) setHintPlayer(calculateHintPlayer(player)); },[player]);

  const bind = useDrag(()=>({}),{filterTaps:true});

  if(!player||!map||!hintPlayer)
    return <Center><BarLoader/></Center>;

  return (
    <Stage
      lose={gameOver}
      restartClick={restartGame}
      map={map}
      player={player}
      hint={hintPlayer}
      paused={pause}
      status={{lines,score,level}}
      tabIndex="0"
      onKeyDown={keyDown}
      onKeyUp={keyUp}
      onClick={rotatePlayer}
      {...bind()}
    />
  );
};

export default Game;
