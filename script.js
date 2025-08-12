import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

// create supabase client from the global SDK
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let tableData = [];

// DOM
const form = document.getElementById('dataForm');
const tableBody = document.querySelector('#dataTable tbody');

// Load initial data from Supabase (fallback to localStorage on error)
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

// simple text escaper
function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// Insert new employee
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const newRow = {
    name: document.getElementById('name').value.trim(),
    age: parseInt(document.getElementById('age').value, 10) || null,
    salary: parseInt(document.getElementById('salary').value, 10) || null,
    gender: document.getElementById('gender').value.trim(),
    custom_id: document.getElementById('custom_id').value.trim()
  };

  // Basic validation
  if (!newRow.name || !newRow.custom_id) return alert('Please provide name and custom ID');

  try {
    const { error } = await supabase.from('employees').insert([newRow]);
    if (error) throw error;
    // no need to update local tableData here — realtime will push the insert
    form.reset();
  } catch (err) {
    // console.error('Insert failed:', err.message || err);
    // alert('Insert failed — check console.');
    console.error('Insert failed:', err);
    alert('Insert failed: ' + (err.message || JSON.stringify(err)));

  }
});

// Delete function exposed to window so button onclick works
window.deleteRow = async function (id) {
  if (!confirm('Delete this record?')) return;
  try {
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) throw error;
    // deletion reflected by realtime subscription
  } catch (err) {
    console.error('Delete failed:', err.message || err);
    alert('Delete failed — check console.');
  }
};

// Subscribe to realtime changes on employees table
function subscribeRealtime() {
  supabase
    .channel('public:employees')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'employees' },
      (payload) => {
        const type = payload.eventType;
        if (type === 'INSERT') {
          // new row (push to tableData)
          tableData.push(payload.new);
        } else if (type === 'DELETE') {
          // remove by id
          tableData = tableData.filter((r) => r.id !== payload.old.id);
        } else if (type === 'UPDATE') {
          // update existing row (optional future support)
          tableData = tableData.map((r) => (r.id === payload.new.id ? payload.new : r));
        }
        renderTable();
      }
    )
    .subscribe();
}

// Start
loadData();
subscribeRealtime();
