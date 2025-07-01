import { memo } from "react"
import useLocalStorage from "../../../custom-hooks/useLocalStorage"

enum ExampleEnum {
    VALUE_1 = "value-1",
    VALUE_2 = "value-2",
    VALUE_3 = "value-3"
}

const HookExample = () => {
    const [number, setNumber] = useLocalStorage<number>("hook-example-number", 0)

    const [selectedEnum, setSelectedEnum] = useLocalStorage<ExampleEnum>(
        "hook-example-enum",
        ExampleEnum.VALUE_1
    )

    const [user, setUser] = useLocalStorage<{ name: string; age: number }>(
        "hook-example-user",
        { name: "Emre", age: 24 }
    )

    const [isValue, setIsValue] = useLocalStorage<boolean>(
        "hook-example-boolean",
        false
    )

    return (
        <div >
            <p>Try to change the values, u can see the change on every tab.</p>

            <h3>Number</h3>
            <button onClick={() => setNumber(number + 1)}>+</button>
            <button onClick={() => setNumber(number - 1)}>-</button>
            <span >{number}</span>

            <h3>Enum</h3>
            <select
                value={selectedEnum}
                onChange={(e) => setSelectedEnum(e.target.value as ExampleEnum)}
            >
                {Object.values(ExampleEnum).map((value) => (
                    <option key={value} value={value}>
                        {value}
                    </option>
                ))}
            </select>

            <h3>User Object</h3>
            <div>
                <input
                    placeholder="Name"
                    value={user.name}
                    onChange={(e) => setUser({ ...user, name: e.target.value })}
                />
                <input
                    type="number"
                    placeholder="Age"
                    value={user.age}
                    onChange={(e) => setUser({ ...user, age: parseInt(e.target.value) })}
                />
                <pre>{JSON.stringify(user, null, 2)}</pre>
            </div>

            <h3>Boolean Toggle</h3>
            <label>
                <input
                    type="checkbox"
                    checked={isValue}
                    onChange={(e) => setIsValue(e.target.checked)}
                />
                Boolean Toggle
            </label>
        </div>
    )
}

export default memo(HookExample)
