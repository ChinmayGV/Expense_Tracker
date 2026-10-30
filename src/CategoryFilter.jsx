function CategoryFilter({ categories, value, onChange }) {
  // Props provide category options, the selected category, and its change callback; selection state stays in App with the other transaction filters.
  return (
    <label className="select-filter">
      <span className="sr-only">Filter by category</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="all">All categories</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>{category.name}</option>
        ))}
      </select>
    </label>
  );
}

export default CategoryFilter;
