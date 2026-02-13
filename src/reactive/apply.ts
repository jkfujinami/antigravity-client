
import { Message, proto3 } from "@bufbuild/protobuf";
import type { MessageType, FieldInfo } from "@bufbuild/protobuf";
import { MessageDiff, FieldDiff, SingularValue, RepeatedDiff, MapDiff } from "../gen/exa/reactive_component_pb_pb.js";

/**
 * Applies a MessageDiff to a target object (which should be a plain JS object representation of a message).
 * @param target The object to modify in place.
 * @param diff The MessageDiff to apply.
 * @param type The MessageType metadata for the target object.
 */
export function applyMessageDiff(target: any, diff: MessageDiff, type: MessageType) {
    if (!diff.fieldDiffs) return;

    for (const fieldDiff of diff.fieldDiffs) {
        applyFieldDiff(target, fieldDiff, type);
    }
}

function applyFieldDiff(target: any, fd: FieldDiff, type: MessageType) {
    const field = type.fields.find(fd.fieldNumber);
    if (!field) {
        console.warn(`[applyFieldDiff] Field ${fd.fieldNumber} not found in ${type.typeName}`);
        return;
    }

    const localName = field.localName;
    let existingValue;

    if (field.oneof) {
        // For oneofs, we only care about existing value if it matches the current case
        const currentOneof = target[field.oneof.localName];
        if (currentOneof && currentOneof.case === localName) {
            existingValue = currentOneof.value;
        }
    } else {
        existingValue = target[localName];
    }

    let value: any;
    switch (fd.diff.case) {
        case "updateSingular":
            value = extractSingularValue(fd.diff.value, field, existingValue);
            break;
        case "updateRepeated":
            applyRepeatedDiff(target, localName, fd.diff.value, field);
            return;
        case "updateMap":
            applyMapDiff(target, localName, fd.diff.value, field);
            return;
        case "clear":
            if (fd.diff.value) value = undefined;
            else return;
            break;
    }

    if (field.oneof) {
        target[field.oneof.localName] = { case: localName, value };
    } else {
        target[localName] = value;
    }
}

function extractSingularValue(sv: SingularValue, field: FieldInfo, existingValue?: any): any {
    if (!sv.value) return undefined;

    switch (sv.value.case) {
        case "doubleValue": return sv.value.value;
        case "floatValue": return sv.value.value;
        case "int32Value": return sv.value.value;
        case "int64Value": return sv.value.value;
        case "uint32Value": return sv.value.value;
        case "uint64Value": return sv.value.value;
        case "sint32Value": return sv.value.value;
        case "sint64Value": return sv.value.value;
        case "fixed32Value": return sv.value.value;
        case "fixed64Value": return sv.value.value;
        case "sfixed32Value": return sv.value.value;
        case "sfixed64Value": return sv.value.value;
        case "boolValue": return sv.value.value;
        case "enumValue": return sv.value.value;
        case "stringValue": return sv.value.value;
        case "bytesValue": return sv.value.value;
        case "messageValue":
            if (field.kind !== "message") {
                console.warn(`[extractSingularValue] Message value for non-message field ${field.name}`);
                return undefined;
            }
            const subType = field.T as MessageType;

            // Reuse existing object if available to preserve reference and unchanged fields
            let subObj = existingValue;
            if (!subObj) {
                try {
                    // Try to instantiate specific message class if possible
                    subObj = new (subType as any)();
                } catch {
                    subObj = {};
                }
            }

            applyMessageDiff(subObj, sv.value.value, subType);
            return subObj;
    }
}

function applyRepeatedDiff(target: any, localName: string, rd: RepeatedDiff, field: FieldInfo) {
    if (!Array.isArray(target[localName])) {
        target[localName] = [];
    }
    const arr = target[localName];

    // Handle length change
    if (rd.newLength !== undefined) {
        if (arr.length > rd.newLength) {
            arr.splice(rd.newLength);
        } else while (arr.length < rd.newLength) {
            arr.push(undefined);
        }
    }

    if (rd.updateIndices && rd.updateValues) {
        if (rd.updateIndices.length !== rd.updateValues.length) {
            console.warn(`[applyRepeatedDiff] Mismatch indices/values length for ${localName}`);
        }

        for (let i = 0; i < rd.updateIndices.length; i++) {
            const idx = rd.updateIndices[i];
            const val = rd.updateValues[i]; // val is SingularValueWrapper usually containing messageValue

            if (field.kind === "message") {
                // Get existing item at index
                let existingItem = arr[idx];

                // If it's a message update, we expect the value case to be messageValue
                // (or strictly generic SingularValue that contains messageValue)
                // We use our extractSingularValue which now supports merging
                arr[idx] = extractSingularValue(val, field, existingItem);
            } else {
                arr[idx] = extractSingularValue(val, field);
            }
        }
    }
}

function applyMapDiff(target: any, localName: string, md: MapDiff, field: FieldInfo) {
    if (field.kind !== "map") return;
    if (!target[localName]) target[localName] = {};
    const map = target[localName];

    for (const keyDiff of md.mapKeyDiffs) {
        if (!keyDiff.mapKey) continue;

        // Extract key (maps usually key by scalar)
        // We need a pseudo-field for the key
        const keyVal = extractSingularValue(keyDiff.mapKey, { kind: "scalar", T: field.K as any } as any);
        const key = String(keyVal);

        if (keyDiff.diff.case === "updateSingular") {
            const existingVal = map[key];

            // Construct pseudo-field info for the value type
            // Careful: T in map info might be numeric ID for scalar, or class for message
            const valueFieldInfo: any = {
                kind: field.V.kind,
                T: field.V.T,
                name: "map_value_pseudo"
            };

            map[key] = extractSingularValue(keyDiff.diff.value, valueFieldInfo, existingVal);

        } else if (keyDiff.diff.case === "clear" && keyDiff.diff.value) {
            delete map[key];
        }
    }
}
