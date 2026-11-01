(()=>{
  const originalFetch=window.fetch.bind(window),key='dtb-committee-review-teams-v1';
  const saved=()=>{try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return []}};
  window.fetch=async(input,options={})=>{
    const url=new URL(typeof input==='string'?input:input.url,location.href);
    if(url.origin===location.origin&&url.pathname==='/api/teams'){
      const response=await originalFetch(new URL('teams-data.json',location.href),{cache:'no-store'});
      if(!response.ok)return response;
      const data=await response.json();
      return Response.json({teams:[...data.teams,...saved()],source:'Committee review snapshot',updated:new Date().toISOString()});
    }
    if(url.origin===location.origin&&url.pathname==='/api/registrations'&&options.method==='POST'){
      const body=JSON.parse(options.body),d=body.draft,teams=saved();
      const team={id:body.id,registered:new Date().toISOString(),team:d.team,location:d.homeLocation,sponsor:d.teamSponsor,division:d.division,goal:Number(d.goal),beneficiary:body.beneficiary,dancer:d.candidateName,title:d.candidateTitle,story:d.story,status:'Demo — browser only'};
      const index=teams.findIndex(t=>t.id===team.id);
      if(index<0)teams.push(team);else teams[index]=team;
      localStorage.setItem(key,JSON.stringify(teams));
      return Response.json({id:team.id,saved:true,demo:true});
    }
    return originalFetch(input,options);
  };
})();
