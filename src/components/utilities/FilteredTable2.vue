<template>
  <div class="overflow-x-auto">
    <table
      class="min-w-full table-auto divide-y divide-gray-200 dark:divide-slate-600 dark:text-gray-300"
    >
      <thead>
        <tr>
          <template v-for="(col, index) in fields" :key="index">
            <th
              scope="col"
              class="px-4 py-2 font-bold first-of-type:text-left last-of-type:text-right cursor-pointer align-top"
            >
              <div class="flex flex-col gap-1">
                <!-- 🏷 Header label -->
                <span
                  v-if="editingColumn !== col.key"
                  @click.stop="editHeader(col.key)"
                >
                  {{ col.label }}
                </span>

                <!-- 🧮 Numeric range (vertical sliders with swap) -->
                <div
                  v-else-if="col.type === 'number'"
                  class="flex flex-col gap-2 mt-1"
                >
                  <div
                    class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400"
                  >
                    <span>Min: {{ numericFilters[col.key].min.toFixed(1) }}</span>
                    <span>Max: {{ numericFilters[col.key].max.toFixed(1) }}</span>
                  </div>

                  <input
                    type="range"
                    :min="getColumnMin(col.key)"
                    :max="getColumnMax(col.key)"
                    step="0.1"
                    v-model.number="numericFilters[col.key].min"
                    @input="normalizeRange(col.key)"
                    class="w-full accent-blue-500"
                  />
                  <input
                    type="range"
                    :min="getColumnMin(col.key)"
                    :max="getColumnMax(col.key)"
                    step="0.1"
                    v-model.number="numericFilters[col.key].max"
                    @input="normalizeRange(col.key)"
                    class="w-full accent-blue-500"
                  />
                </div>

                <!-- ✅ Checkbox multiselect filter -->
                <div
                  v-else-if="col.filterType === 'multiselect'"
                  class="flex flex-col max-h-48 overflow-y-auto text-sm border border-gray-200 dark:border-slate-600 rounded p-1 mt-1"
                  @click.stop
                >
                  <label
                    v-for="option in getDropdownOptions(col.key)"
                    :key="option"
                    class="flex items-center gap-2 py-0.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 px-1 rounded"
                  >
                    <input
                      type="checkbox"
                      :value="option"
                      v-model="multiFilters[col.key]"
                      class="cursor-pointer accent-blue-500"
                    />
                    <span>{{ option }}</span>
                  </label>
                </div>

                <!-- 🔤 Text filter -->
                <input
                  v-else-if="editingColumn === col.key && (col.type === 'string' || !col.type)"
                  type="text"
                  v-model="filters[col.key]"
                  @click.stop
                  @keydown.enter="stopEditing"
                  placeholder="Filter..."
                  class="mt-1 px-1 py-0.5 border border-gray-300 rounded dark:bg-slate-800 dark:border-slate-600"
                />
              </div>
            </th>
          </template>
        </tr>
      </thead>

      <tbody
        class="divide-y divide-gray-200 dark:divide-slate-600 dark:text-gray-300"
      >
        <tr
          v-for="(row, rowIndex) in paginatedItems"
          :key="rowIndex"
          class="odd:bg-gray-300 even:bg-gray-200 dark:odd:bg-slate-800 dark:even:bg-slate-700"
        >
          <td
            v-for="(col, colIndex) in fields"
            :key="colIndex"
            class="px-4 py-2 first-of-type:text-right last-of-type:text-right"
          >
            <!-- ✅ Slot support -->
            <slot :name="'cell(' + col.key + ')'" :row="row">
              <span v-if="col.type === 'number'">{{ formatNumber(row[col.key]) }}</span>
              <span v-else>{{ row[col.key] }}</span>
            </slot>
          </td>
        </tr>

        <tr v-if="paginatedItems.length === 0">
          <td class="px-4 py-2 text-center" :colspan="fields.length">
            No results
          </td>
        </tr>
      </tbody>
    </table>

    <!-- 📄 Pagination -->
    <div
      v-if="perPage > 0"
      class="flex items-center justify-between border-t border-gray-200 py-3 dark:border-slate-600"
    >
      <div>
        <p class="text-sm text-gray-700 dark:text-gray-300">
          Showing
          <span class="font-bold">{{ start + 1 }}</span>
          to
          <span class="font-bold">{{ end }}</span>
          of
          <span class="font-bold">{{ filteredItems.length }}</span>
          results
        </p>
      </div>
      <div>
        <button
          @click="prevPage"
          class="px-3 py-1 border rounded mr-1"
          :disabled="currentPage === 1"
        >
          Prev
        </button>
        <button
          @click="nextPage"
          class="px-3 py-1 border rounded"
          :disabled="currentPage === totalPages"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from "vue";

export default {
  props: {
    fields: { type: Array, required: true },
    items: { type: Array, required: true },
    perPage: { type: Number, default: 5 },
  },
  data() {
    const filters = {};
    const multiFilters = {};
    const numericFilters = {};
    this.fields.forEach((col) => {
      if (col.type === "number") {
        const min = Math.min(...this.items.map((r) => r[col.key]));
        const max = Math.max(...this.items.map((r) => r[col.key]));
        numericFilters[col.key] = { min, max };
      } else if (col.filterType === "multiselect") {
        multiFilters[col.key] = [];
      } else {
        filters[col.key] = "";
      }
    });
    return {
      filters,
      multiFilters,
      numericFilters,
      editingColumn: null,
      currentPage: 1,
    };
  },
  computed: {
    filteredItems() {
      console.log(this.items);
      return this.items.filter((row) => {
        return this.fields.every((col) => {
          const val = row[col.key];

          // Numeric range
          if (col.type === "number") {
            const { min, max } = this.numericFilters[col.key];
            return val >= min && val <= max;
          }

          // Multiselect
          if (col.filterType === "multiselect") {
            const selected = this.multiFilters[col.key];
            if (!selected.length) return true;
            return selected.includes(val);
          }

          // Text
          if (col.type === "string" || !col.type) {
            const filterVal = this.filters[col.key];
            if (!filterVal) return true;
            return String(val).toLowerCase().includes(filterVal.toLowerCase());
          }

          return true;
        });
      });
    },
    paginatedItems() {
      if (this.perPage > 0) {
        console.log(this.filteredItems)
        const start = (this.currentPage - 1) * this.perPage;
        return this.filteredItems.slice(start, start + this.perPage);
      }
      return this.filteredItems;
    },
    totalPages() {
      return Math.ceil(this.filteredItems.length / this.perPage) || 1;
    },
    start() {
      return this.perPage > 0 ? (this.currentPage - 1) * this.perPage : 0;
    },
    end() {
      return this.start + this.paginatedItems.length;
    },
  },
  methods: {
    formatNumber(value) {
      if (value === null || value === undefined || isNaN(value)) return "";
      const abs = Math.abs(value);
      if (abs >= 1_000_000) {
        return (value / 1_000_000).toFixed(3).replace(/\.?0+$/, "") + "M";
      } else if (abs >= 1_000) {
        return (value / 1_000).toFixed(3).replace(/\.?0+$/, "") + "K";
      }
      return Number(value).toFixed(8).replace(/\.?0+$/, "");
    },
    editHeader(field) {
      this.editingColumn = this.editingColumn === field ? null : field;
    },
    stopEditing() {
      this.editingColumn = null;
    },
    getDropdownOptions(field) {
      return Array.from(new Set(this.items.map((row) => row[field])));
    },
    getColumnMin(field) {
      return Math.min(...this.items.map((r) => r[field]));
    },
    getColumnMax(field) {
      return Math.max(...this.items.map((r) => r[field]));
    },
    normalizeRange(field) {
      const range = this.numericFilters[field];
      if (range.min > range.max) [range.min, range.max] = [range.max, range.min];
    },
    nextPage() {
      if (this.currentPage < this.totalPages) this.currentPage++;
    },
    prevPage() {
      if (this.currentPage > 1) this.currentPage--;
    },
  },
};
</script>

<style scoped>
input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  height: 14px;
  width: 14px;
  cursor: pointer;
  background: rgba(246, 59, 59, 1);
  border-radius: 20%;
  border: 2px solid white;
  transition: transform 0.2s;
}
input[type="range"]::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}
</style>
