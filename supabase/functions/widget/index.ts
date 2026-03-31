import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ? undefined : undefined;

// We use the anon key that's public anyway
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const WIDGET_JS = `
(function(){
  if(window.__werkbot_loaded) return;
  window.__werkbot_loaded = true;

  var CHAT_URL = "${SUPABASE_URL}/functions/v1/chat";
  var ANON_KEY = "${ANON_KEY}";

  var LEAD_RE = /\\[LEAD_CAPTURED\\][\\s\\S]*?\\[\\/LEAD_CAPTURED\\]/;
  function stripLead(t){ return t.replace(LEAD_RE,"").trim(); }

  var style = document.createElement("style");
  style.textContent = \`
    #werkbot-root *{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}
    #werkbot-btn{position:fixed;bottom:24px;right:24px;z-index:999999;width:60px;height:60px;border-radius:50%;border:none;cursor:pointer;background:#162040;color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(0,0,0,.3);transition:transform .2s;}
    #werkbot-btn:hover{transform:scale(1.08);}
    #werkbot-btn svg{width:28px;height:28px;}
    #werkbot-panel{position:fixed;bottom:96px;right:24px;z-index:999999;width:380px;max-width:calc(100vw - 32px);height:500px;max-height:70vh;background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,.25);display:flex;flex-direction:column;overflow:hidden;transition:transform .25s ease,opacity .25s ease;transform-origin:bottom right;}
    #werkbot-panel.wb-hidden{transform:scale(0);opacity:0;pointer-events:none;}
    #werkbot-header{background:#162040;color:#fff;padding:14px 18px;flex-shrink:0;border-radius:16px 16px 0 0;display:flex;align-items:center;justify-content:space-between;}
    #werkbot-header h3{font-size:14px;font-weight:600;margin:0;}
    #werkbot-header p{font-size:12px;opacity:.8;margin:2px 0 0;}
    #werkbot-close{background:rgba(255,255,255,.15);border:none;color:#fff;width:28px;height:28px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s;flex-shrink:0;}
    #werkbot-close:hover{background:rgba(255,255,255,.3);}
    #werkbot-close svg{width:16px;height:16px;}
    #werkbot-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;}
    .wb-msg{max-width:80%;padding:10px 16px;border-radius:16px;font-size:14px;line-height:1.5;word-wrap:break-word;}
    .wb-user{align-self:flex-end;background:#7acc29;color:#162040;border-bottom-right-radius:6px;}
    .wb-bot{align-self:flex-start;background:#eef0f4;color:#1e2a3f;border-bottom-left-radius:6px;}
    #werkbot-input-wrap{padding:12px;border-top:1px solid #e5e7eb;flex-shrink:0;display:flex;gap:8px;}
    #werkbot-input{flex:1;border:none;background:#f3f4f6;border-radius:24px;padding:10px 18px;font-size:14px;outline:none;}
    #werkbot-input:focus{box-shadow:0 0 0 2px #7acc29;}
    #werkbot-send{width:40px;height:40px;border-radius:50%;border:none;background:#162040;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
    #werkbot-send:disabled{opacity:.4;cursor:default;}
    #werkbot-send svg{width:16px;height:16px;}
    .wb-typing{display:flex;gap:4px;padding:10px 16px;}
    .wb-typing span{width:8px;height:8px;background:#b0b8c8;border-radius:50%;animation:wbBounce .6s infinite alternate;}
    .wb-typing span:nth-child(2){animation-delay:.2s;}
    .wb-typing span:nth-child(3){animation-delay:.4s;}
    @keyframes wbBounce{to{transform:translateY(-6px);opacity:.5;}}
    @media(max-width:480px){
      #werkbot-panel{width:calc(100vw - 16px);right:8px;bottom:80px;height:60vh;}
      #werkbot-btn{width:52px;height:52px;bottom:16px;right:16px;}
    }
  \`;
  document.head.appendChild(style);

  var root = document.createElement("div");
  root.id = "werkbot-root";
  root.innerHTML = \`
    <div id="werkbot-panel" class="wb-hidden">
      <div id="werkbot-header"><h3>Werkbot</h3><p>Your WerkandMe assistant</p></div>
      <div id="werkbot-msgs"></div>
      <div id="werkbot-input-wrap">
        <input id="werkbot-input" placeholder="Type your message..." />
        <button id="werkbot-send" disabled><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
      </div>
    </div>
    <button id="werkbot-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button>
  \`;
  document.body.appendChild(root);

  var panel = document.getElementById("werkbot-panel");
  var btn = document.getElementById("werkbot-btn");
  var msgs = document.getElementById("werkbot-msgs");
  var input = document.getElementById("werkbot-input");
  var sendBtn = document.getElementById("werkbot-send");
  var history = [{role:"assistant",content:"Hey there! 👋 I'm Werkbot, your WerkandMe assistant. Whether you're curious about our platform or need support, I'm here to help. What can I do for you?"}];
  var loading = false;

  addMsg(history[0].content, "bot");

  btn.onclick = function(){
    panel.classList.toggle("wb-hidden");
    if(!panel.classList.contains("wb-hidden")) input.focus();
  };

  input.oninput = function(){ sendBtn.disabled = !input.value.trim() || loading; };
  input.onkeydown = function(e){ if(e.key==="Enter"&&!sendBtn.disabled) send(); };
  sendBtn.onclick = send;

  function addMsg(text, type){
    var d = document.createElement("div");
    d.className = "wb-msg wb-" + (type==="user"?"user":"bot");
    d.textContent = stripLead(text);
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
    return d;
  }

  function showTyping(){
    var d = document.createElement("div");
    d.className = "wb-msg wb-bot wb-typing";
    d.id = "wb-typing";
    d.innerHTML = "<span></span><span></span><span></span>";
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
  }
  function hideTyping(){ var t=document.getElementById("wb-typing"); if(t)t.remove(); }

  async function send(){
    var text = input.value.trim();
    if(!text||loading) return;
    loading = true;
    input.value = "";
    sendBtn.disabled = true;
    addMsg(text,"user");
    history.push({role:"user",content:text});
    showTyping();

    try{
      var resp = await fetch(CHAT_URL,{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+ANON_KEY},
        body:JSON.stringify({messages:history.map(function(m){return{role:m.role,content:stripLead(m.content)}})})
      });
      if(!resp.ok||!resp.body) throw new Error("fail");
      hideTyping();

      var reader = resp.body.getReader();
      var decoder = new TextDecoder();
      var buf = "";
      var full = "";
      var botEl = null;

      while(true){
        var r = await reader.read();
        if(r.done) break;
        buf += decoder.decode(r.value,{stream:true});
        var nl;
        while((nl=buf.indexOf("\\n"))!==-1){
          var line=buf.slice(0,nl); buf=buf.slice(nl+1);
          if(line.endsWith("\\r"))line=line.slice(0,-1);
          if(!line.startsWith("data: "))continue;
          var json=line.slice(6).trim();
          if(json==="[DONE]")break;
          try{
            var p=JSON.parse(json);
            var c=p.choices&&p.choices[0]&&p.choices[0].delta&&p.choices[0].delta.content;
            if(c){
              full+=c;
              if(!botEl) botEl=addMsg(stripLead(full),"bot");
              else botEl.textContent=stripLead(full);
              msgs.scrollTop=msgs.scrollHeight;
            }
          }catch(e){buf=line+"\\n"+buf;break;}
        }
      }
      history.push({role:"assistant",content:full});

      // Send lead notification if captured
      if(LEAD_RE.test(full)){
        fetch("${SUPABASE_URL}/functions/v1/notify-lead",{
          method:"POST",
          headers:{"Content-Type":"application/json","Authorization":"Bearer "+ANON_KEY},
          body:JSON.stringify({lead:{},conversation:history.map(function(m){return{role:m.role,content:stripLead(m.content)}})})
        }).catch(function(){});
      }
    }catch(e){
      hideTyping();
      addMsg("Sorry, I'm having trouble connecting. Please try again.","bot");
    }finally{
      loading=false;
      sendBtn.disabled=!input.value.trim();
      input.focus();
    }
  }
})();
`;

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(WIDGET_JS, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
