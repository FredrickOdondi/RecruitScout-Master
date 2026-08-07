const recruiters = [{"Country":"Italy","Location":"Milano, Lombardia","Name":"APraise","Size":"11-50 employees","Domain":"apraise.it","status":"Active"}];
const searchQuery = "apr";
const filteredRecruiters = recruiters.filter(r => {
  if (!searchQuery) return true;
  const name = r['Name'] || r['Agency Name'] || '';
  return name.toLowerCase().includes(searchQuery.toLowerCase());
});
console.log(filteredRecruiters);
