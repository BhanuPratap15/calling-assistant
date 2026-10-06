/** Jo page abhi bana nahi — roadmap ka step dikhao */
export function ComingSoon({ title, step }: { title: string; step: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-slate-600">This screen is under construction.</p>
        <p className="mt-1 text-sm text-slate-400">Roadmap: Step {step}</p>
      </div>
    </div>
  );
}
