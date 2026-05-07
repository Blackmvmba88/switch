#include "IOHIDUserDeviceBridge.h"
#include <mach/mach_time.h>

IOHIDUserDeviceRef createVirtualHIDDevice(CFDictionaryRef properties) {
    // We use the modern withProperties call
    IOHIDUserDeviceRef device = IOHIDUserDeviceCreateWithProperties(kCFAllocatorDefault, properties, 0);
    if (device) {
        IOHIDUserDeviceSetDispatchQueue(device, dispatch_get_main_queue());
        IOHIDUserDeviceActivate(device);
    }
    return device;
}

IOReturn sendHIDReport(IOHIDUserDeviceRef device, const uint8_t *report, CFIndex reportLength) {
    uint64_t timestamp = mach_absolute_time();
    return IOHIDUserDeviceHandleReportWithTimeStamp(device, timestamp, report, reportLength);
}
