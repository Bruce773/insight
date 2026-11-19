import assert from "node:assert/strict";
import { mapRows, parseDelimited } from "../src/lib/db/tabular";

assert.deepEqual(parseDelimited('\ufeffA,B\r\n"one, two","line 1\nline ""2"""\r\n', ","), [
  ["A", "B"], ["one, two", 'line 1\nline "2"'],
]);
assert.deepEqual(mapRows("Label\tAmount\nfoo\t0\n", {
  file: "input.txt", columns: { source: { value: "published" } },
}, { label: "label", amount: "amount" }, ["label", "amount", "source"]), [
  { label: "foo", amount: "0", source: "published" },
]);
assert.throws(() => parseDelimited('a,"unfinished', ","));
assert.throws(() => parseDelimited('"a"x,b', ","));
assert.throws(() => mapRows("A,a!\nx,y\n", { file: "x.csv" }, {}, []), /ambiguous/);
assert.throws(() => mapRows("A,B\nx\n", { file: "x.csv" }, {}, []), /expected 2 columns/);
assert.throws(() => mapRows("A\nx\n", { file: "x.csv" }, { needed: "B" }, ["needed"]), /missing required/);
assert.deepEqual(mapRows("Item ID,Item Text\n1,example\n", { file: "x.csv" }, {
  id: ["id", "Item ID"], text: ["text", "Item Text"],
}, ["id", "text"]), [{ id: "1", text: "example" }]);
console.log("Tabular parser tests passed.");
