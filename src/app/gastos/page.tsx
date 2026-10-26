'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { getDocuments, getOrganization } from '@/lib/store';
import { formatCents } from '@/lib/money';
import type { Expense, Document } from '@/types';
import {
  Receipt,
  Plus,
  Trash2,
  TrendingUp,
  PieChart,
  DollarSign,
  Briefcase,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export default function ExpensesPage() {
  const org = getOrganization();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Formulario nuevo gasto
  const [description, setDescription] = useState('');
  const [amountEuros, setAmountEuros] = useState('');
  const [category, setCategory] = useState('materiales');
  const [documentId, setDocumentId] = useState('');
  const [date, setDate] = useState(() => '2027-01-01');

  useEffect(() => {
    const docs = getDocuments();
    setDocuments(docs);
  }, []);

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = parseFloat(amountEuros.replace(',', '.'));
    if (isNaN(cleanAmount) || cleanAmount <= 0) return;

    const amountCents = Math.round(cleanAmount * 100);

    const newExpense: Expense = {
      id: `exp-${Date.now()}`,
      org_id: org?.id || 'org-main',
      document_id: documentId || undefined,
      description: description.trim(),
      amount_cents: amountCents,
      category,
      date,
      created_at: new Date().toISOString(),
    };

    setExpenses([newExpense, ...expenses]);
    setDescription('');
    setAmountEuros('');
  };

  const handleDeleteExpense = (id: string) => {
    setExpenses(expenses.filter((e) => e.id !== id));
  };

  // Cálculos de Rentabilidad
  const totalFacturadoCents = documents
    .filter((d) => d.status === 'issued' || d.status === 'paid' || d.status === 'partially_paid')
    .reduce((sum, d) => sum + d.subtotal_cents, 0);

  const totalGastosCents = expenses.reduce((sum, e) => sum + e.amount_cents, 0);
  const margenNetoCents = totalFacturadoCents - totalGastosCents;
  const margenPct =
    totalFacturadoCents > 0
      ? ((margenNetoCents / totalFacturadoCents) * 100).toFixed(1)
      : '0.0';

  return (
    <AppLayout>
      <div className="p-5 md:p-8 max-w-[1440px] mx-auto space-y-6 animate-fade-in">
        {/* Cabecera */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                RENTABILIDAD Y CONTROL DE COSTES
              </span>
              <span className="text-xs text-gray-400">Gastos directos e imputación a proyectos</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Control de Gastos y Rentabilidad
            </h1>
            <p className="text-xs md:text-sm text-gray-400 mt-1">
              Registro de gastos operativos, suministros y análisis del margen de beneficio real.
            </p>
          </div>
        </div>

        {/* Métricas de Rentabilidad */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="stat-card">
            <span className="text-xs text-gray-400 uppercase font-semibold">Ventas Netas (Bases)</span>
            <div className="text-xl md:text-2xl font-black text-white font-mono mt-1">
              {formatCents(totalFacturadoCents)}
            </div>
            <p className="text-[11px] text-gray-500 mt-1">Facturación neta emitida</p>
          </div>

          <div className="stat-card">
            <span className="text-xs text-gray-400 uppercase font-semibold">Gastos Operativos</span>
            <div className="text-xl md:text-2xl font-black text-rose-400 font-mono mt-1">
              {formatCents(totalGastosCents)}
            </div>
            <p className="text-[11px] text-gray-500 mt-1">Total gastos registrados</p>
          </div>

          <div className="stat-card">
            <span className="text-xs text-gray-400 uppercase font-semibold">Margen Neto (€)</span>
            <div className={`text-xl md:text-2xl font-black font-mono mt-1 ${margenNetoCents >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatCents(margenNetoCents)}
            </div>
            <p className="text-[11px] text-gray-500 mt-1">Beneficio antes de tributación</p>
          </div>

          <div className="stat-card">
            <span className="text-xs text-gray-400 uppercase font-semibold">Rentabilidad (%)</span>
            <div className="text-xl md:text-2xl font-black text-indigo-400 font-mono mt-1">
              {margenPct}%
            </div>
            <p className="text-[11px] text-gray-500 mt-1">Retorno sobre ventas</p>
          </div>
        </div>

        {/* Formulario de Alta de Gasto */}
        <form
          onSubmit={handleAddExpense}
          className="p-5 rounded-2xl bg-[#0D101A] border border-white/10 space-y-4"
        >
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Plus size={16} className="text-rose-400" />
            <span>Registrar Nuevo Gasto</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
            <div className="sm:col-span-2">
              <label className="block text-gray-300 font-semibold mb-1">Concepto del Gasto</label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Compra de perfiles de aluminio y tornillería"
                className="w-full px-3 py-2 bg-[#121626] border border-white/10 rounded-xl text-white text-xs"
              />
            </div>

            <div>
              <label className="block text-gray-300 font-semibold mb-1">Importe (€)</label>
              <input
                type="text"
                required
                value={amountEuros}
                onChange={(e) => setAmountEuros(e.target.value)}
                placeholder="150,00"
                className="w-full px-3 py-2 bg-[#121626] border border-white/10 rounded-xl text-white font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-gray-300 font-semibold mb-1">Categoría</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-[#121626] border border-white/10 rounded-xl text-white text-xs"
              >
                <option value="materiales">Materiales y Suministros</option>
                <option value="subcontratacion">Subcontratación</option>
                <option value="transporte">Transporte y Maquinaria</option>
                <option value="administrativo">Servicios Profesionales</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-300 font-semibold mb-1">Imputar a Proyecto</label>
              <select
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                className="w-full px-3 py-2 bg-[#121626] border border-white/10 rounded-xl text-white text-xs"
              >
                <option value="">Gasto General (Sin proyecto)</option>
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.series ? `${d.series}-${d.number}` : d.title || d.id}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Receipt size={14} />
              <span>Guardar Gasto</span>
            </button>
          </div>
        </form>

        {/* Tabla de Gastos */}
        <div className="bg-[#0C0E18] border border-white/10 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-5 border-b border-white/10">
            <h2 className="text-base font-bold text-white">Libro de Gastos Operativos</h2>
          </div>

          {expenses.length === 0 ? (
            <div className="p-12 text-center">
              <Receipt className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-white">Sin gastos registrados</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                Registre los costes de materiales y subcontratas para obtener el balance de rentabilidad de sus obras.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-white/[0.02] border-b border-white/5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Concepto</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4">Proyecto Imputado</th>
                    <th className="py-3 px-4 text-right">Importe</th>
                    <th className="py-3 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-4 font-mono">{exp.date}</td>
                      <td className="py-3 px-4 text-white font-medium">{exp.description}</td>
                      <td className="py-3 px-4 capitalize">{exp.category}</td>
                      <td className="py-3 px-4">
                        {exp.document_id ? (
                          <span className="font-mono text-indigo-400">{exp.document_id}</span>
                        ) : (
                          <span className="text-gray-500">General</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">
                        {formatCents(exp.amount_cents)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
