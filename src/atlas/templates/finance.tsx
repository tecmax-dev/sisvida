import { useState } from "react";
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Settings,
  Plus,
  Download,
  Receipt,
  TrendingUp,
  CalendarDays,
} from "lucide-react";
import type { TemplateProps } from "../types";
import { list, money, makeId } from "../types";
import {
  AppFrame,
  PageHead,
  Button,
  Stat,
  Panel,
  Search,
  Tabs,
  FormModal,
  SettingPanel,
  LineChart,
  Status,
  Empty,
  exportCSV,
  useToast,
  Progress,
} from "../shared/ui";
export default function Finance({ config }: TemplateProps) {
  const [view, setView] = useState("overview"),
    [transactions, setTransactions] = useState(list(config, "transactions")),
    [period, setPeriod] = useState("Setembro"),
    [filter, setFilter] = useState("Todas"),
    [query, setQuery] = useState(""),
    [create, setCreate] = useState(false);
  const toast = useToast();
  const monthly = transactions.filter((t) =>
    t.date?.startsWith(period === "Setembro" ? "2026-09" : "2026-10"),
  );
  const income = monthly
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + (t.value || 0), 0),
    expense = monthly
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + (t.value || 0), 0);
  const filtered = monthly.filter(
    (t) =>
      (filter === "Todas" ||
        (filter === "Receitas" ? t.type === "income" : t.type === "expense")) &&
      t.title.toLowerCase().includes(query.toLowerCase()),
  );
  let balance = 0;
  const values = [5, 10, 15, 20, 25, 30].map((day) => {
    balance = monthly
      .filter((t) => Number(t.date?.slice(8)) <= day)
      .reduce((s, t) => s + (t.type === "income" ? 1 : -1) * (t.value || 0), 0);
    return balance + 10000;
  });
  return (
    <AppFrame
      config={config}
      active={view}
      onNav={setView}
      nav={[
        {
          id: "overview",
          label: "Visão financeira",
          icon: <Wallet size={18} />,
        },
        {
          id: "transactions",
          label: "Lançamentos",
          icon: <Receipt size={18} />,
        },
        { id: "settings", label: "Preferências", icon: <Settings size={18} /> },
      ]}
    >
      <PageHead
        eyebrow="FINANCEIRO / SEU RESUMO"
        title={config.content.headline}
        description={config.content.description}
      >
        <select
          className="select"
          aria-label="Período"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option>Setembro</option>
          <option>Outubro</option>
        </select>
        <Button onClick={() => setCreate(true)}>
          <Plus size={17} />
          Novo lançamento
        </Button>
      </PageHead>
      {view === "settings" ? (
        <SettingPanel />
      ) : (
        <>
          <div className="stat-grid">
            <Stat
              label="Saldo do período"
              value={money(income - expense)}
              change={`${period} de 2026 · receitas − despesas`}
              accent
            />
            <Stat
              label="Entradas"
              value={money(income)}
              change={`${monthly.filter((t) => t.type === "income").length} recebimentos`}
              icon={<ArrowDownLeft size={18} />}
            />
            <Stat
              label="Saídas"
              value={money(expense)}
              change={`${monthly.filter((t) => t.type === "expense").length} pagamentos`}
              icon={<ArrowUpRight size={18} />}
            />
            <Stat
              label="Saldo acumulado"
              value={money(10000 + income - expense)}
              change="Saldo inicial de exemplo: R$ 10 mil"
              icon={<Wallet size={18} />}
            />
          </div>
          {view === "overview" && (
            <div className="grid-2" style={{ marginBottom: 24 }}>
              <Panel
                title="Seu dinheiro em movimento"
                subtitle={`Saldo acumulado · ${period.toLowerCase()} de 2026`}
                action={<span className="badge accent">Fluxo de caixa</span>}
              >
                <LineChart
                  values={values}
                  labels={["05", "10", "15", "20", "25", "30"]}
                />
              </Panel>
              <Panel title="Para onde foi" subtitle="Despesas por categoria">
                <div className="panel-body expense-breakdown">
                  {["Pessoas", "Operação", "Ferramentas"].map((c) => {
                    const v = monthly
                      .filter((t) => t.category === c && t.type === "expense")
                      .reduce((s, t) => s + (t.value || 0), 0);
                    return (
                      <div key={c}>
                        <div className="between">
                          <span>{c}</span>
                          <b>{money(v)}</b>
                        </div>
                        <Progress value={expense ? (v / expense) * 100 : 0} />
                      </div>
                    );
                  })}
                </div>
                <div className="finance-insight">
                  <TrendingUp size={21} />
                  <p>
                    Clareza hoje.
                    <br />
                    <b>Melhores decisões amanhã.</b>
                  </p>
                </div>
              </Panel>
            </div>
          )}
          <Panel
            title="Últimas movimentações"
            subtitle="Cada detalhe do seu caixa"
            action={
              <Button
                variant="ghost"
                onClick={() =>
                  exportCSV(
                    "financeiro.csv",
                    ["Descrição", "Data", "Tipo", "Valor"],
                    filtered.map((t) => [
                      t.title,
                      t.date,
                      t.type === "income" ? "Receita" : "Despesa",
                      t.value,
                    ]),
                  )
                }
              >
                <Download size={15} />
                Exportar
              </Button>
            }
          >
            <div className="toolbar panel-body" style={{ paddingBottom: 0 }}>
              <Tabs
                items={["Todas", "Receitas", "Despesas"]}
                value={filter}
                onChange={setFilter}
              />
              <Search
                value={query}
                onChange={setQuery}
                placeholder="Buscar lançamento…"
              />
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Descrição</th>
                    <th>Categoria</th>
                    <th>Data</th>
                    <th>Status</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <div className="inline">
                          <span className={`transaction-icon ${t.type}`}>
                            {t.type === "income" ? (
                              <ArrowDownLeft size={18} />
                            ) : (
                              <ArrowUpRight size={18} />
                            )}
                          </span>
                          <b>{t.title}</b>
                        </div>
                      </td>
                      <td>{t.category}</td>
                      <td>{t.date?.split("-").reverse().join("/")}</td>
                      <td>
                        <Status value={t.status} />
                      </td>
                      <td
                        className={t.type === "income" ? "money-positive" : ""}
                      >
                        <b>
                          {t.type === "income" ? "+" : "−"}{" "}
                          {money(t.value || 0)}
                        </b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!filtered.length && (
              <Empty
                title="Nenhum lançamento neste período"
                text="Experimente setembro ou adicione uma nova movimentação."
              />
            )}
          </Panel>
        </>
      )}
      <FormModal
        open={create}
        onClose={() => setCreate(false)}
        title="Novo lançamento"
        fields={[
          { name: "title", label: "Descrição" },
          {
            name: "type",
            label: "Tipo",
            type: "select",
            options: ["Receita", "Despesa"],
          },
          { name: "value", label: "Valor (R$)", type: "number", min: 0.01 },
          {
            name: "date",
            label: "Data",
            type: "date",
            value: period === "Setembro" ? "2026-09-30" : "2026-10-01",
          },
          {
            name: "category",
            label: "Categoria",
            type: "select",
            options: ["Recebimentos", "Pessoas", "Operação", "Ferramentas"],
          },
        ]}
        onSubmit={(d) => {
          setTransactions((p) => [
            {
              ...d,
              id: makeId(),
              title: d.title,
              value: Number(d.value),
              type: d.type === "Receita" ? "income" : "expense",
              status: d.type === "Receita" ? "Recebido" : "Pago",
            },
            ...p,
          ]);
          toast("Lançamento registrado localmente.");
        }}
      />
    </AppFrame>
  );
}
