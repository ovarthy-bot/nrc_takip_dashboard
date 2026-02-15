
let mappings = [];

function saveMapping(){
  const rows = document.querySelectorAll("#mapping-body tr");
  const data = [];
  rows.forEach(r=>{
    const wo = r.children[0].innerText.trim();
    const aircraft = r.children[1].innerText.trim();
    if(wo && aircraft){
      data.push({wo, aircraft});
    }
  });
  localStorage.setItem("wo_aircraft_map", JSON.stringify(data));
  alert("Kaydedildi");
}
