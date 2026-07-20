type ModulePlaceholderProps = {
  title: string;
  description: string;
  plannedFeatures: string[];
};

export function ModulePlaceholder({
  title,
  description,
  plannedFeatures,
}: Readonly<ModulePlaceholderProps>) {
  return (
    <section>
      <p className="text-sm font-medium text-sky-700">Không gian phát triển</p>
      <h1 className="mt-2 text-3xl font-bold">{title}</h1>
      <p className="mt-3 text-slate-600">{description}</p>
      <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-6">
        <h2 className="font-semibold">Chức năng dự kiến</h2>
        <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-slate-600">
          {plannedFeatures.map((feature) => <li key={feature}>{feature}</li>)}
        </ul>
      </div>
    </section>
  );
}
