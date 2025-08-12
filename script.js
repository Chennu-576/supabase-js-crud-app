import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let tableData = [];

const form = document.getElementById('dataForm');
const tableBody = document.querySelector('#dataTable tbody');


async function loadData() {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;

    tableData = data || [];
    localStorage.setItem('employeeData', JSON.stringify(tableData));
  } catch (err) {
    console.error('Supabase load failed — using localStorage', err.message || err);
    tableData = JSON.parse(localStorage.getItem('employeeData')) || [];
  }
  renderTable();
}

function renderTable() {
  tableBody.innerHTML = '';
  tableData.forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(row.name)}</td>
      <td>${row.age ?? ''}</td>
      <td>${row.salary ?? ''}</td>
      <td>${escapeHtml(row.gender)}</td>
      <td>${escapeHtml(row.custom_id)}</td>
      <td><button class="delete-btn" onclick="deleteRow('${row.id}')">Delete</button></td>
    `;
    tableBody.appendChild(tr);
  });
  localStorage.setItem('employeeData', JSON.stringify(tableData));
}

function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}


form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const newRow = {
    name: document.getElementById('name').value.trim(),
    age: parseInt(document.getElementById('age').value, 10) || null,
    salary: parseInt(document.getElementById('salary').value, 10) || null,
    gender: document.getElementById('gender').value.trim(),
    custom_id: document.getElementById('custom_id').value.trim()
  };

  if (!newRow.name || !newRow.custom_id) return alert('Please provide name and custom ID');

  try {
    const { error } = await supabase.from('employees').insert([newRow]);
    if (error) throw error;
   
    form.reset();
  } catch (err) {
    // console.error('Insert failed:', err.message || err);
    // alert('Insert failed — check console.');
    console.error('Insert failed:', err);
    alert('Insert failed: ' + (err.message || JSON.stringify(err)));

  }
});

window.deleteRow = async function (id) {
  if (!confirm('Delete this record?')) return;
  try {
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) throw error;
    
  } catch (err) {
    console.error('Delete failed:', err.message || err);
    alert('Delete failed — check console.');
  }
};

function subscribeRealtime() {
  supabase
    .channel('public:employees')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'employees' },
      (payload) => {
        const type = payload.eventType;
        if (type === 'INSERT') {
          
          tableData.push(payload.new);
        } else if (type === 'DELETE') {
          
          tableData = tableData.filter((r) => r.id !== payload.old.id);
        } else if (type === 'UPDATE') {
         
          tableData = tableData.map((r) => (r.id === payload.new.id ? payload.new : r));
        }
        renderTable();
      }
    )
    .subscribe();
}


loadData();
subscribeRealtime();
